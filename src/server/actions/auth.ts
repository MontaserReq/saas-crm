'use server';

import prisma from '@/lib/db/prisma';
import { loginSchema } from '@/lib/validation';
import { verifyPassword, hashPassword, createSession, destroySession, getCurrentUser } from '@/lib/auth/session';
import { AuditService } from '@/server/services/AuditService';
import { RoleName } from '@/types';
import { randomUUID } from 'crypto';
import { createHash, randomBytes } from 'crypto';
import { sendTransactionalEmail } from '@/lib/email';
import { getRequestContext, parseAllowedIps } from '@/lib/security/request';
import { checkRateLimit, RATE_LIMIT_POLICY_CONFIG } from '@/lib/security/rateLimiter';

const RESET_TTL_MS = 3 * 60 * 1000;
const RESET_GENERIC_MESSAGE = 'If an account exists for this email address, a password reset link will be sent.';

function hashResetToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

function buildResetEmail(name: string, link: string, language: 'en' | 'ar') {
  const isAr = language === 'ar';
  const subject = isAr ? 'إعادة تعيين كلمة مرور CodeLine JO' : 'Reset your CodeLine JO password';
  const greeting = isAr ? `مرحباً ${name}،` : `Hello ${name},`;
  const intro = isAr
    ? 'تلقينا طلباً لإعادة تعيين كلمة مرور حسابك في CodeLine JO.'
    : 'You requested to reset your CodeLine JO password.';
  const cta = isAr ? 'اضغط على الزر أدناه لإنشاء كلمة مرور جديدة.' : 'Click the button below to create a new password.';
  const expiry = isAr
    ? 'ينتهي صلاحية هذا الرابط بعد 3 دقائق ويمكن استخدامه مرة واحدة فقط.'
    : 'This link expires in 3 minutes and can only be used once.';
  const ignore = isAr
    ? 'إذا لم تطلب إعادة التعيين هذه، يمكنك تجاهل هذه الرسالة بأمان.'
    : 'If you did not request this reset, you can safely ignore this email.';
  const button = isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Password';
  const dir = isAr ? 'rtl' : 'ltr';
  const text = `${greeting}\n\n${intro} ${cta}\n${link}\n\n${expiry}\n\n${ignore}`;
  const html = `<div dir="${dir}" style="font-family:Tajawal,Arial,sans-serif;background:#f4f4f7;padding:32px 0;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#3b0764;padding:24px;text-align:center;">
        <span style="color:#ffffff;font-weight:900;font-size:20px;letter-spacing:1px;">CodeLine JO</span>
      </div>
      <div style="padding:32px;color:#1e293b;">
        <p style="margin:0 0 16px;font-size:14px;">${greeting}</p>
        <p style="margin:0 0 16px;font-size:14px;">${intro} ${cta}</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;display:inline-block;">${button}</a>
        </div>
        <p style="margin:0 0 12px;font-size:12px;color:#64748b;">${expiry}</p>
        <p style="margin:0;font-size:12px;color:#64748b;">${ignore}</p>
      </div>
    </div>
  </div>`;
  return { subject, text, html };
}

export async function forgotPasswordAction(emailInput: string, language: 'en' | 'ar' = 'en') {
  const email = emailInput.trim().toLowerCase();
  const request = getRequestContext();
  const now = Date.now();
  try {
    const policy = RATE_LIMIT_POLICY_CONFIG.password_reset;
    const ipLimit = await checkRateLimit({ policy: 'password_reset', identity: `forgot-ip:${request.ipAddress}`, ...policy });
    if (!ipLimit.allowed) {
      return { success: true, message: RESET_GENERIC_MESSAGE };
    }
    if (!email || !loginSchema.shape.email.safeParse(email).success) return { success: true, message: RESET_GENERIC_MESSAGE };
    const emailLimit = await checkRateLimit({ policy: 'password_reset', identity: `forgot-email:${email}`, ...policy });
    if (!emailLimit.allowed) {
      return { success: true, message: RESET_GENERIC_MESSAGE };
    }

    // Best-effort cleanup of expired/used tokens so the table does not grow unbounded.
    await prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now) } }, { usedAt: { not: null } }] } }).catch(() => undefined);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, isActive: true } });
    if (!user || !user.isActive) return { success: true, message: RESET_GENERIC_MESSAGE };

    const rawToken = randomBytes(32).toString('hex');
    await prisma.$transaction(async (tx) => {
      // A newer reset request invalidates any previously issued, still-active tokens for this user.
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashResetToken(rawToken), expiresAt: new Date(now + RESET_TTL_MS) } });
      await tx.auditLog.create({ data: { actorId: user.id, action: 'PASSWORD_RESET_REQUESTED', entityType: 'User', entityId: user.id, metadata: JSON.stringify({ email: user.email }), ipAddress: request.ipAddress, userAgent: request.userAgent } });
    });

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (!appUrl) {
      console.error('Password reset: APP_URL is not configured, cannot send reset email');
      return { success: true, message: RESET_GENERIC_MESSAGE };
    }
    const link = `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const { subject, text, html } = buildResetEmail(user.name, link, language === 'ar' ? 'ar' : 'en');
    // Fire-and-forget: never let SMTP latency/failure leak timing information or block the generic response.
    void sendTransactionalEmail({ to: user.email, subject, text, html }).catch((error) => {
      console.error('Password reset email delivery failed', error instanceof Error ? error.message : 'unknown error');
    });
  } catch (error) {
    console.error('Password reset request failed', error instanceof Error ? error.message : 'unknown error');
  }
  return { success: true, message: RESET_GENERIC_MESSAGE };
}

// Read-only status check for the reset-password page's initial render (UX only).
// This performs no mutation and is NOT the security boundary — resetPasswordAction's
// atomic claim below is the sole authority on whether a token may actually be consumed.
export async function checkResetTokenAction(token: string): Promise<'VALID' | 'EXPIRED' | 'ALREADY_USED' | 'INVALID'> {
  if (!token) return 'INVALID';
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) }, select: { usedAt: true, expiresAt: true } });
  if (!reset) return 'INVALID';
  if (reset.usedAt) return 'ALREADY_USED';
  if (reset.expiresAt <= new Date()) return 'EXPIRED';
  return 'VALID';
}

export async function resetPasswordAction(token: string, newPassword: string, confirmPassword: string) {
  if (!token) return { success: false, error: 'INVALID_TOKEN' };
  if (newPassword.length < 8) return { success: false, error: 'PASSWORD_TOO_SHORT' };
  if (newPassword !== confirmPassword) return { success: false, error: 'PASSWORD_MISMATCH' };
  const request = getRequestContext();
  const tokenHash = hashResetToken(token);
  const resetPolicy = RATE_LIMIT_POLICY_CONFIG.password_reset;
  const ipLimit = await checkRateLimit({ policy: 'password_reset', identity: `reset-ip:${request.ipAddress}`, ...resetPolicy });
  const tokenLimit = await checkRateLimit({ policy: 'password_reset', identity: `reset-token:${tokenHash}`, ...resetPolicy });
  if (!ipLimit.allowed || !tokenLimit.allowed) return { success: false, error: 'RESET_FAILED' };
  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      // Atomic compare-and-swap: a single UPDATE...WHERE is row-locked by Postgres, so of any
      // number of concurrent requests for the same token, exactly one can match usedAt: null
      // and flip it. Every other concurrent (or later) request sees count === 0 and is rejected —
      // there is no read-then-write window for a race to exploit.
      const claim = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claim.count === 0) {
        const existing = await tx.passwordResetToken.findUnique({ where: { tokenHash }, select: { usedAt: true, expiresAt: true } });
        if (!existing) throw new Error('INVALID_RESET_TOKEN');
        if (existing.usedAt) throw new Error('TOKEN_ALREADY_USED');
        if (existing.expiresAt <= now) throw new Error('TOKEN_EXPIRED');
        throw new Error('INVALID_RESET_TOKEN');
      }

      const claimed = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!claimed) throw new Error('INVALID_RESET_TOKEN');
      const user = await tx.user.findUnique({ where: { id: claimed.userId }, select: { id: true, isActive: true } });
      if (!user || !user.isActive) throw new Error('INVALID_RESET_TOKEN');

      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, id: { not: claimed.id } } });
      await tx.loginSession.updateMany({ where: { userId: user.id, logoutAt: null }, data: { logoutAt: now } });
      await tx.auditLog.create({ data: { actorId: user.id, action: 'PASSWORD_RESET_COMPLETED', entityType: 'User', entityId: user.id, metadata: JSON.stringify({}), ipAddress: request.ipAddress, userAgent: request.userAgent } });
    });
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_ALREADY_USED') return { success: false, error: 'TOKEN_ALREADY_USED' };
    if (error instanceof Error && error.message === 'TOKEN_EXPIRED') return { success: false, error: 'TOKEN_EXPIRED' };
    if (error instanceof Error && error.message === 'INVALID_RESET_TOKEN') return { success: false, error: 'INVALID_TOKEN' };
    console.error('Password reset failed', error instanceof Error ? error.message : 'unknown error');
    return { success: false, error: 'RESET_FAILED' };
  }
}

export async function loginAction(formData: { email: string; password: string }) {
  try {
    const validated = loginSchema.parse({ ...formData, email: formData.email.trim() });
    const normalizedEmail = validated.email.trim().toLowerCase();
    const request = getRequestContext();
    const policy = RATE_LIMIT_POLICY_CONFIG.login;
    const [ipLimit, accountLimit] = await Promise.all([
      checkRateLimit({ policy: 'login', identity: `login-ip:${request.ipAddress}`, ...policy }),
      checkRateLimit({ policy: 'login', identity: `login-account:${normalizedEmail}`, ...policy }),
    ]);
    if (!ipLimit.allowed || !accountLimit.allowed) return { success: false, error: 'Invalid email or password' };

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        department: true,
        userPermissions: { include: { permission: true } },
      },
    });

    if (!user || !user.isActive) {
      await AuditService.logAudit({ action: 'AUTH_LOGIN_FAILED', entityType: 'User', metadata: { email: validated.email }, ipAddress: request.ipAddress, userAgent: request.userAgent });
      return { success: false, error: 'Invalid email or password' };
    }

    const isValid = await verifyPassword(validated.password, user.passwordHash);
    if (!isValid) {
      await AuditService.logAudit({ actorId: user.id, action: 'AUTH_LOGIN_FAILED', entityType: 'User', entityId: user.id, metadata: { reason: 'invalid_password' }, ipAddress: request.ipAddress, userAgent: request.userAgent });
      return { success: false, error: 'Invalid email or password' };
    }

    const allowedIps = parseAllowedIps(user.allowedIps);
    if (user.accessMode === 'RESTRICTED_IPS' && !allowedIps.includes(request.ipAddress)) {
      await prisma.loginSession.create({ data: { userId: user.id, ipAddress: request.ipAddress, deviceInfo: request.userAgent, browser: request.browser, operatingSystem: request.operatingSystem, denied: true, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
      await AuditService.logAudit({ actorId: user.id, action: 'AUTH_LOGIN_DENIED_IP', entityType: 'User', entityId: user.id, metadata: { reason: 'ip_not_allowed' }, ipAddress: request.ipAddress, userAgent: request.userAgent });
      return { success: false, error: 'Login denied: this account is restricted to approved IP addresses.' };
    }

    const sessionId = randomUUID();
    await prisma.loginSession.create({ data: { id: sessionId, userId: user.id, ipAddress: request.ipAddress, deviceInfo: request.userAgent, browser: request.browser, operatingSystem: request.operatingSystem, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const permissions = Array.from(new Set([
      ...user.role.rolePermissions.map((rp) => rp.permission.code),
      ...user.userPermissions.map((up) => up.permission.code),
    ]));

    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name as RoleName,
      roleDisplayName: user.role.displayName,
      departmentId: user.department.id,
      departmentName: user.department.name,
      reportsToUserId: user.reportsToUserId,
      permissions,
      sessionId,
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email },
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Login failed' };
  }
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    if (user.sessionId) await prisma.loginSession.updateMany({ where: { id: user.sessionId, userId: user.id, logoutAt: null }, data: { logoutAt: new Date() } });
    await AuditService.logAudit({
      actorId: user.id,
      action: 'AUTH_LOGOUT',
      entityType: 'User',
      entityId: user.id,
      ipAddress: getRequestContext().ipAddress,
      userAgent: getRequestContext().userAgent,
    });
  }
  await destroySession();
  return { success: true };
}

export async function getSessionAction() {
  const user = await getCurrentUser();
  return { user };
}
