export function insertIntoText(
  value: string,
  token: string,
  start: number,
  end: number
): { text: string; cursor: number } {
  const text = `${value.slice(0, start)}${token}${value.slice(end)}`;
  return { text, cursor: start + token.length };
}

export function insertIntoContentEditable(editable: HTMLElement, text: string): boolean {
  editable.focus();
  const selection = window.getSelection();
  if (!selection) return false;

  if (!selection.rangeCount || !editable.contains(selection.anchorNode)) {
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.setEndAfter(node);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
