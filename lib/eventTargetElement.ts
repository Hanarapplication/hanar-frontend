/**
 * Touch/click `event.target` can be a Text node or other non-Element node.
 * Walk up a few ancestors so `.closest()` is always called on an `Element`.
 */
export function eventTargetToNearestElement(target: EventTarget | null): Element | null {
  if (target == null) return null;
  let node: Node | null = target as Node;
  for (let i = 0; i < 12 && node; i++) {
    if (node instanceof Element) return node;
    node = node.parentNode;
  }
  return null;
}
