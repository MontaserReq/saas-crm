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

const resetRateLimit = new Map<string, { count: number; resetAt: number }>();
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX_REQUESTS = 5;
const RESET_TTL_MS = 3 * 60 * 1000;

function hashResetToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

export async function forgotPasswordAction(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const generic = 'If an account exists for this email address, a password reset link will be sent.';
  if (!email || !loginSchema.shape.email.safeParse(email).success) return { success: true, message: generic };
  const now = Date.now();
  const rate = resetRateLimit.get(email);
  if (rate && rate.resetAt > now && rate.count >= RESET_MAX_REQUESTS) return { success: true, message: generic };
  resetRateLimit.set(email, rate && rate.resetAt > now ? { count: rate.count + 1, resetAt: rate.resetAt } : { count: 1, resetAt: now + RESET_WINDOW_MS });
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
  if (!user) return { success: true, message: generic };
  const rawToken = randomBytes(32).toString('hex');
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashResetToken(rawToken), expiresAt: new Date(now + RESET_TTL_MS) } });
    await tx.auditLog.create({ data: { action: 'PASSWORD_RESET_REQUESTED', entityType: 'User', entityId: user.id, metadata: JSON.stringify({ email: user.email }) } });
  });
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (!appUrl) throw new Error('APP_URL is not configured');
  const link = `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
  try {
    await sendTransactionalEmail({ to: user.email, subject: 'CodeLine JO password reset', text: `Reset your password within 3 minutes: ${link}`, html: `<p>Hello ${user.name},</p><p><a href="${link}">Reset your password</a></p><p>This link expires in 3 minutes.</p>` });
  } catch (error) {
    console.error('Password reset email delivery failed', error instanceof Error ? error.message : 'unknown error');
  }
  return { success: true, message: generic };
}

export async function resetPasswordAction(token: string, newPassword: string, confirmPassword: string) {
  if (!token || newPassword.length < 8 || newPassword !== confirmPassword) return { success: false, error: 'Invalid password reset request' };
  const tokenHash = hashResetToken(token);
  const passwordHash = await hashPassword(newPassword);
  try {
    await prisma.$transaction(async (tx) => {
      const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new Error('INVALID_RESET_TOKEN');
      const user = await tx.user.findUnique({ where: { id: reset.userId }, select: { id: true, isActive: true } });
      if (!user) throw new Error('INVALID_RESET_TOKEN');
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, id: { not: reset.id } } });
      await tx.loginSession.updateMany({ where: { userId: user.id, logoutAt: null }, data: { logoutAt: new Date() } });
      await tx.auditLog.create({ data: { action: 'PASSWORD_RESET_COMPLETED', entityType: 'User', entityId: user.id, metadata: JSON.stringify({ accountActive: user.isActive }) } });
    });
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_RESET_TOKEN') return { success: false, error: 'Invalid or expired password reset link' };
    return { success: false, error: 'Password reset failed' };
  }
}

export async function loginAction(formData: { email: string; password: string }) {
  try {
    const validated = loginSchema.parse(formData);

    const user = await prisma.user.findUnique({
      where: { email: validated.email.toLowerCase() },
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

    const request = getRequestContext();
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
