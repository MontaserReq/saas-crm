export const TRUST_PROXY_SINGLE_HOP = 'single-hop' as const;

type Environment = Record<string, string | undefined>;

function parseOrigin(raw: string | undefined, requireHttps: boolean): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (requireHttps && url.protocol !== 'https:') return null;
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function configuredOrigin(env: Environment = process.env): string | null {
  return parseOrigin(env.APP_ORIGIN, env.NODE_ENV === 'production');
}

export function trustsSingleHopProxy(env: Environment = process.env): boolean {
  return env.TRUST_PROXY?.trim() === TRUST_PROXY_SINGLE_HOP;
}

/**
 * Production runs behind exactly one sanitizing TLS-termination proxy. The app
 * service must not be reachable directly when this mode is enabled.
 */
export function validateProductionSecurityConfig(env: Environment = process.env) {
  if (env.NODE_ENV !== 'production') return;

  if (!configuredOrigin(env)) {
    throw new Error('APP_ORIGIN must be an origin-only HTTPS URL in production');
  }
  if (!trustsSingleHopProxy(env)) {
    throw new Error(`TRUST_PROXY must be exactly "${TRUST_PROXY_SINGLE_HOP}" in production`);
  }
}
