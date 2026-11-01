export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function safeProviderEndpoint(value: string | null | undefined): string | null {
  const normalized = safeExternalUrl(value);
  if (!normalized) return null;
  const hostname = new URL(normalized).hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === '0.0.0.0' || hostname === '::1') return null;
  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return null;
  return normalized;
}
