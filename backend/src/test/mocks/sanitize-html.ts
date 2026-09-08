type TransformResult = {
  tagName: string;
  attribs: Record<string, string>;
};

type SanitizeOptions = {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  transformTags?: Record<string, (tagName: string, attribs: Record<string, string>) => TransformResult>;
};

function parseAttribs(attrString: string): Record<string, string> {
  const attribs: Record<string, string> = {};
  const pattern = /([\w:-]+)=["']([^"']*)["']/g;
  let match = pattern.exec(attrString);
  while (match) {
    attribs[match[1]] = match[2];
    match = pattern.exec(attrString);
  }
  return attribs;
}

function renderTag(tagName: string, attribs: Record<string, string>): string {
  const attrs = Object.entries(attribs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  return attrs ? `<${tagName} ${attrs}>` : `<${tagName}>`;
}

function applyTransformTags(html: string, options?: SanitizeOptions): string {
  if (!options?.transformTags) return html;
  return html.replace(/<(\w+)([^>]*)>/g, (full, tagName, attrString) => {
    const transformer = options.transformTags?.[tagName];
    if (!transformer) return full;
    const transformed = transformer(tagName, parseAttribs(attrString));
    return renderTag(transformed.tagName, transformed.attribs);
  });
}

function sanitizeHtml(html: string, options?: SanitizeOptions): string {
  const withoutScripts = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  if (options?.allowedTags?.length === 0) {
    return withoutScripts.replace(/<[^>]+>/g, " ");
  }
  return applyTransformTags(withoutScripts, options);
}

sanitizeHtml.simpleTransform = () => (tagName: string, attribs: Record<string, string>) => ({
  tagName,
  attribs,
});

export default sanitizeHtml;
