import dns from 'node:dns/promises';
import net from 'node:net';
import { safeExternalUrl } from '@/lib/security/url';
import { sanitizeExternalContent } from '@/lib/security/external';

function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }
  return true;
}

export async function assertPublicUrl(value: string): Promise<string> {
  const normalized = safeExternalUrl(value);
  if (!normalized) throw new Error('Only valid http(s) URLs are allowed');
  const url = new URL(normalized);
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || net.isIP(hostname) && privateIp(hostname)) throw new Error('Private network URLs are not allowed');
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((address) => privateIp(address.address))) throw new Error('Private network URLs are not allowed');
  return url.href;
}

export async function fetchPublicContent(value: string, maxBytes = 500_000): Promise<{ url: string; content: string }> {
  const url = await assertPublicUrl(value);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { Accept: 'text/html,text/plain,application/xhtml+xml' }, cache: 'no-store' });
  if (response.status >= 300 && response.status < 400) throw new Error('Redirects are not followed for external content');
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/') && !contentType.includes('html') && !contentType.includes('json')) throw new Error('External content type is not supported');
  const reader = response.body?.getReader();
  if (!reader) return { url, content: sanitizeExternalContent((await response.text()).slice(0, maxBytes)) };
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const next = await reader.read();
    if (next.done) break;
    const chunk = next.value as Uint8Array;
    const remaining = maxBytes - size;
    chunks.push(chunk.byteLength <= remaining ? chunk : chunk.slice(0, remaining));
    size += Math.min(chunk.byteLength, remaining);
    if (chunk.byteLength > remaining) break;
  }
  return { url, content: sanitizeExternalContent(new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))) ) };
}
