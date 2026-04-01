export type AnchorRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type OverlaySize = {
  width: number;
  height: number;
};

export type Viewport = {
  width: number;
  height: number;
};

export type OverlayPlacement = 'above-start' | 'below-start';

export type AnchoredPosition = {
  top: number;
  left: number;
  placement: OverlayPlacement;
};

const MIN_MARGIN = 8;
const RIGHT_MARGIN = 16;

export function computeAnchoredOverlayPosition({
  anchorRect,
  overlaySize,
  viewport,
  offset,
}: {
  anchorRect: AnchorRect;
  overlaySize: OverlaySize;
  viewport: Viewport;
  offset: number;
}): AnchoredPosition {
  let top = anchorRect.bottom + offset;
  let left = anchorRect.left;
  let placement: OverlayPlacement = 'below-start';

  if (top + overlaySize.height > viewport.height) {
    top = anchorRect.top - overlaySize.height - offset;
    placement = 'above-start';
  }

  if (left + overlaySize.width > viewport.width - RIGHT_MARGIN) {
    left = viewport.width - overlaySize.width - RIGHT_MARGIN;
  }

  if (left < MIN_MARGIN) {
    left = MIN_MARGIN;
  }

  if (top < MIN_MARGIN) {
    top = MIN_MARGIN;
  }

  return { top, left, placement };
}

export function watchAnchorPosition(
  win: Window,
  element: Element,
  onUpdate: (rect: DOMRect) => void
): () => void {
  const update = () => {
    onUpdate(element.getBoundingClientRect());
  };

  win.addEventListener('scroll', update, { passive: true } as AddEventListenerOptions);
  win.addEventListener('resize', update, { passive: true } as AddEventListenerOptions);

  return () => {
    win.removeEventListener('scroll', update);
    win.removeEventListener('resize', update);
  };
}
