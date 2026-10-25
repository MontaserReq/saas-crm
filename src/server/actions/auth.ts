'use server';

import prisma from '@/lib/db/prisma';
import { cookies } from 'next/headers';
import { loginSchema, registerOrganizationSchema, resetPasswordSchema, resetTokenSchema } from '@/lib/validation';
import { verifyPassword, hashPassword, createSession, destroySession, getCurrentUser } from '@/lib/auth/session';
import { AuditService } from '@/server/services/AuditService';
import { RoleName } from '@/types';
import { randomUUID } from 'crypto';
import { createHash, randomBytes } from 'crypto';
import { sendTransactionalEmail } from '@/lib/email';
import { getRequestContext, parseAllowedIps } from '@/lib/security/request';
import { checkRateLimit, consumeRateLimit, peekRateLimit, RATE_LIMIT_POLICY_CONFIG } from '@/lib/security/rateLimiter';
import { initialSetup, readSetupState } from '@/lib/onboarding/templates';
import { WORKSPACE_OWNER_PERMISSIONS } from '@/lib/onboarding/permissions';
import { expandPlanFeatures, TRIAL_DURATION_MS } from '@/lib/platform/entitlements';

const RESET_TTL_MS = 3 * 60 * 1000;
const RESET_GENERIC_MESSAGE = 'If an account exists for this email address, a password reset link will be sent.';
const SIGNUP_PLAN_CONFIGURATION_ERROR = 'SIGNUP_PLAN_UNAVAILABLE';

function hashResetToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

function buildResetEmail(name: string, link: string, language: 'en' | 'ar') {
  const isAr = language === 'ar';
  const subject = isAr ? 'إعادة تعيين كلمة مرور SatrCRM' : 'Reset your SatrCRM password';
  const greeting = isAr ? `مرحباً ${name}،` : `Hello ${name},`;
  const intro = isAr
    ? 'تلقينا طلباً لإعادة تعيين كلمة مرور حسابك في SatrCRM.'
    : 'You requested to reset your SatrCRM password.';
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
  const logoOrigin = (() => {
    try { return new URL(link).origin; } catch { return ''; }
  })();
  const logoMarkup = logoOrigin
    ? `<img src="${logoOrigin}/branding/satrcrm-en-white.png" alt="SatrCRM" width="190" style="display:inline-block;width:190px;height:auto;" />`
    : '<span style="color:#ffffff;font-weight:900;font-size:20px;letter-spacing:1px;">SatrCRM</span>';
  const html = `<div dir="${dir}" style="font-family:Tajawal,Arial,sans-serif;background:#f4f4f7;padding:32px 0;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#3b0764;padding:24px;text-align:center;">
        ${logoMarkup}
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
  const request = await getRequestContext();
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
      await tx.auditLog.create({ data: { actorId: user.id, action: 'PASSWORD_RESET_REQUESTED', entityType: 'User', entityId: user.id, metadata: JSON.stringify({ reset: true }), ipAddress: request.ipAddress, userAgent: request.userAgent } });
    });

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (!appUrl) {
      console.error('Password reset: APP_URL is not configured, cannot send reset email');
      return { success: true, message: RESET_GENERIC_MESSAGE };
    }
    const link = `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const { subject, text, html } = buildResetEmail(user.name, link, language === 'ar' ? 'ar' : 'en');
    // Fire-and-forget: never let SMTP latency/failure leak timing information or block the generic response.
    void sendTransactionalEmail({ to: user.email, subject, text, html }).catch(() => {
      console.error('Password reset email delivery failed');
    });
  } catch {
    console.error('Password reset request failed');
  }
  return { success: true, message: RESET_GENERIC_MESSAGE };
}

// Read-only status check for the reset-password page's initial render (UX only).
// This performs no mutation and is NOT the security boundary — resetPasswordAction's
// atomic claim below is the sole authority on whether a token may actually be consumed.
export async function checkResetTokenAction(token: string): Promise<'VALID' | 'EXPIRED' | 'ALREADY_USED' | 'INVALID'> {
  const parsedToken = resetTokenSchema.safeParse(token);
  if (!parsedToken.success) return 'INVALID';
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(parsedToken.data) }, select: { usedAt: true, expiresAt: true } });
  if (!reset) return 'INVALID';
  if (reset.usedAt) return 'ALREADY_USED';
  if (reset.expiresAt <= new Date()) return 'EXPIRED';
  return 'VALID';
}

export async function resetPasswordAction(token: string, newPassword: string, confirmPassword: string) {
  const parsedInput = resetPasswordSchema.safeParse({ token, newPassword, confirmPassword });
  if (!parsedInput.success) {
    const issue = parsedInput.error.issues[0]?.message || 'RESET_FAILED';
    if (issue === 'Passwords do not match') return { success: false, error: 'PASSWORD_MISMATCH' };
    if (issue.includes('at least 8')) return { success: false, error: 'PASSWORD_TOO_SHORT' };
    return { success: false, error: 'INVALID_TOKEN' };
  }
  ({ token, newPassword, confirmPassword } = parsedInput.data);
  const request = await getRequestContext();
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
    console.error('Password reset failed');
    return { success: false, error: 'RESET_FAILED' };
  }
}

export async function loginAction(formData: { email: string; password: string }) {
  try {
    const validated = loginSchema.parse({ ...formData, email: formData.email.trim() });
    const normalizedEmail = validated.email.trim().toLowerCase();
    const request = await getRequestContext();
    const policy = RATE_LIMIT_POLICY_CONFIG.login;
    const [ipLimit, accountLimit] = await Promise.all([
      peekRateLimit({ policy: 'login', identity: `login-ip:${request.ipAddress}`, ...policy }),
      peekRateLimit({ policy: 'login', identity: `login-account:${normalizedEmail}`, ...policy }),
    ]);
    if (!ipLimit.allowed || !accountLimit.allowed) return { success: false, error: 'Invalid email or password' };

    const consumeFailedLogin = async () => {
      await Promise.all([
        consumeRateLimit({ policy: 'login', identity: `login-ip:${request.ipAddress}`, ...policy }),
        consumeRateLimit({ policy: 'login', identity: `login-account:${normalizedEmail}`, ...policy }),
      ]);
    };

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
      await consumeFailedLogin();
      await AuditService.logAudit({ action: 'AUTH_LOGIN_FAILED', entityType: 'User', metadata: { email: validated.email }, ipAddress: request.ipAddress, userAgent: request.userAgent });
      return { success: false, error: 'Invalid email or password' };
    }

    const isValid = await verifyPassword(validated.password, user.passwordHash);
    if (!isValid) {
      await consumeFailedLogin();
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

    return { success: true, role: user.role.name as RoleName };
  } catch {
    console.error('Login failed');
    return { success: false, error: 'Login failed. Please try again.' };
  }
}

// Anonymous funnel start uses an opaque, HTTP-only attempt cookie. No email or
// business answers are collected before registration; starts that never finish
// remain measurable in the audit stream.
async function signupAttempt() {
  const cookieStore = await cookies();
  const existingId = cookieStore.get('codeline_signup_attempt')?.value;
  const existing = existingId && /^[0-9a-f-]{36}$/.test(existingId) ? await prisma.auditLog.findFirst({ where: { entityId: existingId, action: 'SIGNUP_STARTED', createdAt: { gt: new Date(Date.now() - 86400000) } } }) : null;
  if (existing) return existing;
  const attemptId = randomUUID();
  const started = await prisma.auditLog.create({ data: { action: 'SIGNUP_STARTED', entityType: 'OnboardingAttempt', entityId: attemptId, metadata: JSON.stringify({ version: 1 }) } });
  cookieStore.set('codeline_signup_attempt', attemptId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 86400 });
  return started;
}
export async function beginSignupAction() {
  try {
    const request = await getRequestContext();
    const limit = await checkRateLimit({ policy: 'login', identity: `signup-start:${request.ipAddress}`, ...RATE_LIMIT_POLICY_CONFIG.login });
    if (!limit.allowed) return { success: false };
    await signupAttempt(); return { success: true };
  } catch { return { success: false }; }
}

export async function registerOrganizationAction(input: { workspace: string; name: string; email: string; password: string; confirmPassword: string; language?: 'en' | 'ar' }) {
  try {
    const signupPolicy = await prisma.platformSetting.findUnique({ where: { key: 'signup_enabled' }, select: { value: true } });
    if (signupPolicy?.value === 'false') return { success: false, error: 'SIGNUP_DISABLED' };
    const parsedInput = registerOrganizationSchema.safeParse(input);
    if (!parsedInput.success) return { success: false, error: 'SIGNUP_INVALID' };
    const { workspace, name, email, password, language } = parsedInput.data;
    const request = await getRequestContext();
    const limit = await checkRateLimit({ policy: 'login', identity: `signup:${request.ipAddress}`, ...RATE_LIMIT_POLICY_CONFIG.login });
    if (!limit.allowed) return { success: false, error: 'SIGNUP_RETRY' };

    const attempt = await signupAttempt();
    let newlyCreated = false;
    // A lost response can be retried with the original credentials. The unique
    // email constraint prevents duplicate users/tenants even under concurrency.
    const resume = async () => {
      const existing = await prisma.user.findUnique({ where: { email }, include: { department: true, organizationMemberships: { where: { status: 'ACTIVE', organization: { isActive: true } }, include: { organization: { include: { settings: true, platformSubscription: true } } } } } });
      if (!existing || !existing.isActive || existing.isPlatformAdmin || existing.accessMode !== 'ANY_IP' || existing.organizationMemberships.length !== 1 || !await verifyPassword(password, existing.passwordHash)) return null;
      const membership = existing.organizationMemberships[0];
      if (!membership.organization.platformSubscription) return null;
      const state = readSetupState(membership.organization.settings?.onboardingState);
      if (!state || state.ownerId !== existing.id || state.status !== 'PENDING' || membership.roleId !== existing.roleId) return null;
      return { user: existing, department: existing.department, organization: membership.organization, state };
    };
    const role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' }, include: { rolePermissions: { include: { permission: true } } } });
    if (!role) return { success: false, error: 'SIGNUP_RETRY' };
    // The retry path includes relations while the fresh transaction returns
    // the newly created records before relation reloading; normalize both
    // shapes through this narrow local boundary.
    let created: any = await resume();
    if (!created && await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      // Another identical request may have committed after the first lookup.
      // Recheck authenticated recovery before treating it as an existing account.
      created = await resume();
      if (!created) return { success: false, error: 'SIGNUP_EXISTS' };
    }
    if (!created) {
      const passwordHash = await hashPassword(password);
      const slugBase = workspace.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'workspace';
      const slug = `${slugBase}-${randomUUID().slice(0, 8)}`;
      try {
        created = await prisma.$transaction(async tx => {
          const defaultPlanSetting = await tx.platformSetting.findUnique({ where: { key: 'signup_default_plan_slug' }, select: { value: true } });
          if (!defaultPlanSetting?.value) throw new Error(SIGNUP_PLAN_CONFIGURATION_ERROR);
          const defaultPlan = await tx.platformPlan.findFirst({ where: { slug: defaultPlanSetting.value, isActive: true }, select: { id: true, name: true, slug: true, features: true } });
          if (!defaultPlan) throw new Error(SIGNUP_PLAN_CONFIGURATION_ERROR);
          const organization = await tx.organization.create({ data: { name: workspace, slug, language } });
          const department = await tx.department.create({ data: { organizationId: organization.id, name: language === 'ar' ? 'الإدارة' : 'Management', code: `MANAGEMENT_${randomUUID().slice(0, 8)}`, description: 'Workspace management' } });
          const user = await tx.user.create({ data: { name, email, passwordHash, roleId: role.id, departmentId: department.id, isPlatformAdmin: false } });
          await tx.organizationMember.create({ data: { organizationId: organization.id, userId: user.id, roleId: role.id, status: 'ACTIVE' } });
          const capabilities = await tx.permission.findMany({ where: { code: { in: [...WORKSPACE_OWNER_PERMISSIONS] } }, select: { id: true } });
          if (capabilities.length !== WORKSPACE_OWNER_PERMISSIONS.length) throw new Error('Workspace permission catalog is not initialized');
          await tx.userPermission.createMany({ data: capabilities.map(permission => ({ userId: user.id, permissionId: permission.id })) });
          const state = initialSetup(user.id, workspace, language, attempt.createdAt.toISOString());
          await tx.organizationSettings.create({ data: { organizationId: organization.id, onboardingState: JSON.stringify(state) } });
          const trialStartedAt = new Date();
          const trialEndsAt = new Date(trialStartedAt.getTime() + TRIAL_DURATION_MS);
          await tx.platformSubscription.create({ data: { organizationId: organization.id, planId: defaultPlan.id, status: 'TRIAL', billingInterval: 'monthly', startsAt: trialStartedAt, endsAt: trialEndsAt, trialStartedAt, trialEndsAt, notes: 'Seven-day trial created atomically from the configured public-signup plan' } });
          for (const action of ['SIGNUP_COMPLETED', 'ONBOARDING_STARTED']) await tx.auditLog.create({ data: { actorId: user.id, organizationId: organization.id, action, entityType: 'Organization', entityId: organization.id, metadata: JSON.stringify({ version: 1, signupStartedAt: state.signupStartedAt, attemptId: attempt.entityId }) } });
          return { organization, department, user, state };
        });
        newlyCreated = true;
      } catch (error) {
        created = await resume();
        if (!created) throw error;
      }
    }
    // Only company-owner signups can recover this public registration path.
    if (created.user.roleId !== role.id) return { success: false, error: 'SIGNUP_EXISTS' };
    const sessionId = randomUUID();
    await prisma.loginSession.create({ data: { id: sessionId, userId: created.user.id, ipAddress: request.ipAddress, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    const signupSubscription = await prisma.platformSubscription.findUniqueOrThrow({ where: { organizationId: created.organization.id }, include: { plan: true } });
    const directPermissions = await prisma.userPermission.findMany({ where: { userId: created.user.id }, select: { permission: { select: { code: true } } } });
    await createSession({ id: created.user.id, name: created.user.name, email: created.user.email, role: 'SUPER_ADMIN', isPlatformAdmin: false, roleDisplayName: role.displayName, departmentId: created.department.id, departmentName: created.department.name, reportsToUserId: null, permissions: [...new Set([...role.rolePermissions.map(item => item.permission.code), ...directPermissions.map(item => item.permission.code)])], sessionId, organizationId: created.organization.id, organizationName: created.organization.name, planFeatures: expandPlanFeatures(signupSubscription.plan.features), planName: signupSubscription.plan.name, planSlug: signupSubscription.plan.slug, workspaceAccessState: 'ACTIVE_TRIAL', workspaceReadOnly: false, subscriptionStartsAt: signupSubscription.startsAt.toISOString(), subscriptionEndsAt: signupSubscription.endsAt?.toISOString() ?? null });
    await AuditService.logAudit({ actorId: created.user.id, organizationId: created.organization.id, action: 'ORGANIZATION_SIGNUP', entityType: 'Organization', entityId: created.organization.id, metadata: { version: 1 } });
    if (newlyCreated) {
      // Retain the existing platform signup notification, with explicit platform authority.
      const admins = await prisma.organizationMember.findMany({ where: { status: 'ACTIVE', user: { isActive: true, isPlatformAdmin: true, role: { name: 'PLATFORM_ADMIN' } }, role: { name: 'PLATFORM_ADMIN' } }, select: { userId: true, organizationId: true } }).catch(() => []);
      if (admins.length) await prisma.notification.createMany({ data: admins.map(admin => ({ ...admin, type: 'ORGANIZATION_SIGNUP', title: 'New organization signup', message: `${created!.organization.name} was created.`, entityType: 'Organization', entityId: created!.organization.id })) }).catch(() => undefined);
    }
    return { success: true, state: created.state };
  } catch (error) {
    if (error instanceof Error && error.message === SIGNUP_PLAN_CONFIGURATION_ERROR) {
      console.error('Organization registration is unavailable because the signup plan is not configured');
      return { success: false, error: SIGNUP_PLAN_CONFIGURATION_ERROR };
    }
    console.error('Organization registration failed');
    return { success: false, error: 'SIGNUP_RETRY' };
  }
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    const request = await getRequestContext();
    if (user.sessionId) await prisma.loginSession.updateMany({ where: { id: user.sessionId, userId: user.id, logoutAt: null }, data: { logoutAt: new Date() } });
    await AuditService.logAudit({
      actorId: user.id,
      action: 'AUTH_LOGOUT',
      entityType: 'User',
      entityId: user.id,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });
  }
  await destroySession();
  return { success: true };
}

export async function getSessionAction() {
  const user = await getCurrentUser();
  return { user };
}
