import { describe, expect, it } from 'vitest';
import { MCP_TOKEN_PREFIX, parseMcpScopes, validateMcpTokenSecret } from '@/lib/mcp/accessTokens';
import { mcpOriginAllowed } from '@/lib/mcp/http';

describe('MCP access boundaries', () => {
  it('accepts only the supported read scope and removes duplicates', () => {
    expect(parseMcpScopes(['crm.read', 'crm.read'])).toEqual(['crm.read']);
    expect(parseMcpScopes(['crm.write', 'admin', 4])).toEqual([]);
  });

  it('rejects malformed, short, and non-MCP bearer secrets', () => {
    expect(validateMcpTokenSecret('')).toBe(false);
    expect(validateMcpTokenSecret('Bearer sat_mcp_anything')).toBe(false);
    expect(validateMcpTokenSecret(`${MCP_TOKEN_PREFIX}${'a'.repeat(31)}`)).toBe(false);
    expect(validateMcpTokenSecret(`${MCP_TOKEN_PREFIX}${'a'.repeat(40)}`)).toBe(true);
  });

  it('does not allow browser origins unless explicitly configured', () => {
    const previous = process.env.MCP_ALLOWED_ORIGINS;
    delete process.env.MCP_ALLOWED_ORIGINS;
    expect(mcpOriginAllowed(new Request('https://crm.example/api/mcp', { headers: { Origin: 'https://untrusted.example' } }))).toBe(false);
    process.env.MCP_ALLOWED_ORIGINS = 'https://trusted.example';
    expect(mcpOriginAllowed(new Request('https://crm.example/api/mcp', { headers: { Origin: 'https://trusted.example' } }))).toBe(true);
    if (previous === undefined) delete process.env.MCP_ALLOWED_ORIGINS;
    else process.env.MCP_ALLOWED_ORIGINS = previous;
  });
});
