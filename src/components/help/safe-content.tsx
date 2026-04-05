/**
 * Safe markdown-to-HTML renderer.
 * Converts markdown content to HTML with sanitization — no XSS risk.
 *
 * SEC-M4: Defense-in-depth sanitization added below.
 * The pipeline is:
 *   1. markdownToSafeHtml — escapes all raw input via escapeHtml(), only
 *      emits known-safe tags from ALLOWED_TAGS.
 *   2. stripDisallowedTags — strips any tag that is not in ALLOWED_TAGS as a
 *      belt-and-suspenders pass before dangerouslySetInnerHTML.
 *
 * For client-only rendering, additionally install DOMPurify:
 *   npm install dompurify
 *   npm install --save-dev @types/dompurify
 * Then replace the sanitize call below with:
 *   import DOMPurify from 'dompurify';
 *   const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: [...ALLOWED_TAGS], ALLOWED_ATTR: ['href','class','target','rel'] });
 */

const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u',
  'a', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'hr',
]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToSafeHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { html.push('</ul>'); inList = false; }
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3 class="text-lg font-bold text-slate-800 mt-6 mb-3">${escapeHtml(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h2 class="text-xl font-bold text-slate-800 mt-8 mb-4">${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h1 class="text-2xl font-extrabold text-slate-800 mt-8 mb-4">${escapeHtml(trimmed.slice(2))}</h1>`);
      continue;
    }

    // List items
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      if (!inList) { html.push('<ul class="list-disc pl-5 mb-4 space-y-1">'); inList = true; }
      html.push(`<li class="text-slate-600">${inlineFormat(trimmed.slice(2))}</li>`);
      continue;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      if (!inList) { html.push('<ol class="list-decimal pl-5 mb-4 space-y-1">'); inList = true; }
      html.push(`<li class="text-slate-600">${inlineFormat(trimmed.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    // Paragraph
    if (inList) { html.push('</ul>'); inList = false; }
    html.push(`<p class="mb-3 text-slate-600 leading-relaxed">${inlineFormat(trimmed)}</p>`);
  }

  if (inList) html.push('</ul>');
  return html.join('\n');
}

function inlineFormat(text: string): string {
  let safe = escapeHtml(text);
  // Bold
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-800">$1</strong>');
  // Italic
  safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  safe = safe.replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded text-sm">$1</code>');
  // Links — only allow http/https/mailto
  safe = safe.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g,
    '<a href="$2" class="text-cnci-blue underline hover:text-cnci-dark" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // Email addresses
  safe = safe.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" class="text-cnci-blue underline">$1</a>'
  );
  return safe;
}

/**
 * Belt-and-suspenders: strip any HTML tag that is not in ALLOWED_TAGS.
 * This runs after markdownToSafeHtml so that even if a future code change
 * inadvertently emits an unlisted tag, it is removed before rendering.
 * Attributes are also filtered to the safe set: href, class, target, rel.
 */
const ALLOWED_ATTRS = new Set(['href', 'class', 'target', 'rel']);

function stripDisallowedTags(html: string): string {
  // Remove opening tags that are not in ALLOWED_TAGS (keep their inner text)
  let safe = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, tag, attrs) => {
    const lower = tag.toLowerCase() as string;
    if (!ALLOWED_TAGS.has(lower)) {
      return ''; // strip unknown tag entirely
    }
    // Filter attributes to the safe list
    const filteredAttrs = attrs.replace(/([a-zA-Z-]+)\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/g, (attrMatch: string, attrName: string) => {
      return ALLOWED_ATTRS.has(attrName.toLowerCase()) ? attrMatch : '';
    });
    // Reconstruct tag without the closing slash variant (closing tags have no attrs anyway)
    return match.startsWith('</') ? `</${lower}>` : `<${lower}${filteredAttrs}>`;
  });

  // Remove any javascript: or data: URIs that may appear in href values
  safe = safe.replace(/href\s*=\s*"(?:javascript|data):[^"]*"/gi, 'href="#"');
  safe = safe.replace(/href\s*=\s*'(?:javascript|data):[^']*'/gi, "href='#'");

  return safe;
}

interface SafeContentProps {
  content: string;
  className?: string;
}

export function SafeContent({ content, className }: SafeContentProps) {
  const rawHtml = markdownToSafeHtml(content);
  const safeHtml = stripDisallowedTags(rawHtml);
  return <div className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
