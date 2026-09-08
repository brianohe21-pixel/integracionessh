export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "mailto:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveAnchor(root: HTMLElement, selection?: Node): HTMLAnchorElement | null {
  let node: Node | null | undefined = selection;
  if (!node && root.contains(document.activeElement)) {
    node = window.getSelection()?.anchorNode ?? null;
  }
  while (node && node !== root) {
    if (node instanceof HTMLAnchorElement) return node;
    if (node instanceof Element && node.nodeName === "A") return node as HTMLAnchorElement;
    node = node.parentNode;
  }
  return null;
}

export function getRangeText(range: Range | null): string {
  if (!range || range.collapsed) return "";
  return range.toString();
}

export function unwrapAnchor(anchor: HTMLAnchorElement) {
  const parent = anchor.parentNode;
  if (!parent) return;
  while (anchor.firstChild) {
    parent.insertBefore(anchor.firstChild, anchor);
  }
  parent.removeChild(anchor);
}

export function readAnchorHref(anchor: HTMLAnchorElement): string {
  return anchor.getAttribute("href") ?? anchor.href;
}
