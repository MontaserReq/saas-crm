import { describe, expect, it, beforeEach } from 'vitest';
import { rateLimit } from '@/lib/security/api';
import fs from 'node:fs';
import path from 'node:path';

describe('API hardening', () => {
  beforeEach(() => {
    delete process.env.TRUST_PROXY;
  });

  it('does not trust forwarded headers unless a trusted proxy is configured', () => {
    const request = new Request('http://localhost/api/public-search', { headers: { 'x-forwarded-for': '10.0.0.1', 'x-real-ip': '10.0.0.2' } });
    expect(rateLimit(request, 'test-a', 1, 60_000).allowed).toBe(true);
    expect(rateLimit(request, 'test-a', 1, 60_000).allowed).toBe(false);
  });

  it('uses the forwarded client IP only behind a configured trusted proxy', () => {
    process.env.TRUST_PROXY = 'true';
    const first = new Request('http://localhost/api/public-search', { headers: { 'x-forwarded-for': '10.0.0.3' } });
    const second = new Request('http://localhost/api/public-search', { headers: { 'x-forwarded-for': '10.0.0.4' } });
    expect(rateLimit(first, 'test-b', 1, 60_000).allowed).toBe(true);
    expect(rateLimit(first, 'test-b', 1, 60_000).allowed).toBe(false);
    expect(rateLimit(second, 'test-b', 1, 60_000).allowed).toBe(true);
  });

  it('fails closed for unconfigured chatbot proxy paths and does not expose raw template errors', () => {
    const proxy = fs.readFileSync(path.resolve(__dirname, '../../src/app/api/chatbot/proxy/[...path]/route.ts'), 'utf8');
    const template = fs.readFileSync(path.resolve(__dirname, '../../src/app/api/proposals/templates/[id]/route.ts'), 'utf8');
    expect(proxy).toMatch(/CHATBOT_PROXY_ALLOWED_PATHS/);
    expect(proxy).toMatch(/status: 404/);
    expect(template).not.toMatch(/err\.message/);
  });

  it('defines a bounded template upload size', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../src/server/services/ProposalTemplateService.ts'), 'utf8');
    expect(source).toMatch(/MAX_TEMPLATE_BYTES = 10 \* 1024 \* 1024/);
  });

  it('defines streaming proxy body enforcement', () => {
    const proxy = fs.readFileSync(path.resolve(__dirname, '../../src/app/api/chatbot/proxy/[...path]/route.ts'), 'utf8');
    expect(proxy).toMatch(/getReader\(\)/);
    expect(proxy).toMatch(/PayloadTooLargeError/);
    expect(proxy).not.toMatch(/request\.arrayBuffer\(\)/);
  });
});
