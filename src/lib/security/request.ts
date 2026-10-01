import { headers } from 'next/headers';
import { resolveClientIp } from '@/lib/security/api';

export function getRequestContext(runtimeIp?: string | null) {
  const h = headers();
  const ipAddress = resolveClientIp({
    forwarded: h.get('x-forwarded-for'),
    realIp: h.get('x-real-ip'),
    runtimeIp,
  });
  const userAgent = h.get('user-agent') || 'unknown';
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'Other';
  const operatingSystem = /Windows/.test(userAgent) ? 'Windows' : /Mac OS/.test(userAgent) ? 'macOS' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Linux/.test(userAgent) ? 'Linux' : 'Other';
  return { ipAddress, userAgent, browser, operatingSystem };
}

export function parseAllowedIps(value?: string | null): string[] {
  try { return value ? JSON.parse(value) : []; } catch { return []; }
}
