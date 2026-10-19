const STYLE_PROPS = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "MozTabSize",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
] as const;

export type TextareaSelectionRect = {
  top: number;
  left: number;
  bottom: number;
  height: number;
};

function measureCaretOffset(
  textarea: HTMLTextAreaElement,
  index: number
): { top: number; left: number; height: number } {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");

  const mirrorStyle = mirror.style as CSSStyleDeclaration & Record<string, string>;
  const computed = style as CSSStyleDeclaration & Record<string, string>;
  STYLE_PROPS.forEach((prop) => {
    mirrorStyle[prop] = computed[prop];
  });

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.top = "0";
  mirror.style.left = "0";
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.height = "auto";
  mirror.style.overflow = "hidden";

  const value = textarea.value;
  const before = value.slice(0, index);
  mirror.textContent = before;

  const marker = document.createElement("span");
  marker.textContent = value.slice(index, index + 1) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const top = marker.offsetTop - textarea.scrollTop;
  const left = marker.offsetLeft - textarea.scrollLeft;
  const height = marker.offsetHeight;
  document.body.removeChild(mirror);

  return { top, left, height };
}

export function getTextareaSelectionRect(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number
): TextareaSelectionRect {
  const startPos = measureCaretOffset(textarea, Math.min(start, end));
  const endPos = measureCaretOffset(textarea, Math.max(start, end));
  const top = Math.min(startPos.top, endPos.top);
  const bottom = Math.max(startPos.top + startPos.height, endPos.top + endPos.height);

  return {
    top,
    left: startPos.left,
    bottom,
    height: bottom - top,
  };
}
