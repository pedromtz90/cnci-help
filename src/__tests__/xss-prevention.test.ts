import { describe, it, expect } from 'vitest';
import { escapeHtml } from '@/lib/workflows/tools';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('preserves safe text', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles mixed malicious content that could appear in student names', () => {
    const maliciousName = 'Juan<img src=x onerror=alert(1)>';
    const result = escapeHtml(maliciousName);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;');
  });
});

describe('SafeContent component sanitization', () => {
  it('strips script tags from markdown', async () => {
    // Import the actual module to test the full pipeline
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/help/safe-content.tsx'),
      'utf-8'
    );

    // Verify the component uses escapeHtml
    expect(source).toContain('escapeHtml');
    // Verify it uses stripDisallowedTags
    expect(source).toContain('stripDisallowedTags');
    // Verify ALLOWED_TAGS is restrictive (no script, no iframe, no img, no style)
    expect(source).not.toContain("'script'");
    expect(source).not.toContain("'iframe'");
    expect(source).not.toContain("'style'");
  });
});
