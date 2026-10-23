import DOMPurify, { type Config, type DOMPurify as DOMPurifyInstance } from 'dompurify';

/**
 * Shared sanitizer for untrusted HTML (external email bodies, archived mail, server-rendered
 * documents) before it is handed to Angular via bypassSecurityTrustHtml / innerHTML.
 *
 * DOMPurify already removes <script>, on* event handlers and javascript:/vbscript: URLs.
 * On top of that we drop anything that can embed other documents, submit data or change
 * how relative URLs resolve. Inline styles, tables, images (incl. data:/cid: images) and
 * links are kept so email formatting survives.
 */
const FORBID_TAGS = [
  'script', 'noscript', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'portal',
  'form', 'input', 'button', 'select', 'option', 'textarea', 'base', 'link', 'meta', 'template',
];
const FORBID_ATTR = ['action', 'formaction', 'srcdoc', 'ping'];

let purifier: DOMPurifyInstance | null = null;

/** Dedicated DOMPurify instance so our hook does not affect other users of the library (e.g. jsPDF). */
function getPurifier(): DOMPurifyInstance {
  if (!purifier) {
    purifier = DOMPurify(window);
    // Open every link in a new tab without giving the target page a handle on this window.
    purifier.addHook('afterSanitizeAttributes', (node: Element) => {
      if (node.tagName === 'A' && node.hasAttribute('href')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }
  return purifier;
}

/**
 * Sanitize an untrusted HTML fragment (e.g. an email body) for insertion into the app's DOM.
 * <style> blocks are removed too, so an email cannot restyle the surrounding intranet UI.
 */
export function sanitizeUntrustedHtml(html: string | null | undefined): string {
  if (!html) return '';
  const config: Config = {
    FORBID_TAGS: [...FORBID_TAGS, 'style'],
    FORBID_ATTR,
  };
  return getPurifier().sanitize(html, config);
}

/**
 * Sanitize a complete HTML document (keeps <head>/<style>) before writing it into a
 * same-origin window, e.g. a print popup.
 */
export function sanitizeHtmlDocument(html: string | null | undefined): string {
  if (!html) return '';
  const config: Config = {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS,
    FORBID_ATTR,
  };
  const clean = getPurifier().sanitize(html, config);
  // DOMPurify drops the doctype; restore it so the document does not render in quirks mode.
  return /^\s*<!doctype html/i.test(html) ? `<!DOCTYPE html>\n${clean}` : clean;
}
