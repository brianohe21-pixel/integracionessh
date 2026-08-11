type SanitizeOptions = {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
};

function sanitizeHtml(html: string, options?: SanitizeOptions): string {
  const withoutScripts = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  if (options?.allowedTags?.length === 0) {
    return withoutScripts.replace(/<[^>]+>/g, " ");
  }
  return withoutScripts;
}

sanitizeHtml.simpleTransform = () => (tagName: string, attribs: Record<string, string>) => ({
  tagName,
  attribs,
});

export default sanitizeHtml;
