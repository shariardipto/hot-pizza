import sanitizeHtml from 'sanitize-html';

/** Rich text allow-list (legal pages, long descriptions). */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'blockquote', 'hr', 'span'],
    allowedAttributes: { a: ['href', 'target', 'rel'], span: ['class'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.href && /^https?:/i.test(attribs.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
      }),
    },
  });
}
