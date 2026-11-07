import { describe, expect, it } from 'vitest';
import { validateDocumentContent } from '@/server/services/DocumentService';

describe('CRM document content security', () => {
  it('accepts the editor JSON format and safe web links', () => {
    const value = validateDocumentContent(JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Open', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }] }],
    }));
    expect(value).toContain('https://example.com');
  });

  it('accepts safe text styling marks', () => {
    const value = validateDocumentContent(JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Styled', marks: [{ type: 'textStyle', attrs: { color: '#7c3aed', fontFamily: 'Tajawal, Arial, sans-serif', fontSize: '18px' } }] }] }],
    }));
    expect(value).toContain('18px');
  });

  it('rejects unsafe text styling values', () => {
    expect(() => validateDocumentContent(JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bad', marks: [{ type: 'textStyle', attrs: { color: 'red; background:url(javascript:alert(1))' } }] }] }],
    }))).toThrow('Document text color is invalid.');
  });

  it('rejects unsafe link protocols', () => {
    expect(() => validateDocumentContent(JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }],
    }))).toThrow('Only safe web links are allowed.');
  });

  it('rejects unsupported blocks', () => {
    expect(() => validateDocumentContent(JSON.stringify({ type: 'doc', content: [{ type: 'script', attrs: { html: '<script>alert(1)</script>' } }] }))).toThrow('unsupported block');
  });
});
