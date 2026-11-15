import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

// Los enlaces externos se abren en otra pestaña para no sacar al visitante del sitio
if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') ?? '')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/**
 * Markdown -> HTML seguro.
 * En el servidor (build de Astro) solo se renderiza la semilla del repo, que es
 * confiable; en el navegador todo pasa por DOMPurify.
 */
export function renderMarkdown(src: string | undefined): string {
  if (!src) return '';
  const html = marked.parse(src, { async: false }) as string;
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
}

/** Markdown en una sola línea (sin <p> envolvente). */
export function renderInline(src: string | undefined): string {
  if (!src) return '';
  const html = marked.parseInline(src, { async: false }) as string;
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html);
}
