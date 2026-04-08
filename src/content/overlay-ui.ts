type OverlayElement = {
  appendChild(child: OverlayElement): OverlayElement;
  textContent: string | null;
  className: string;
  id: string;
  title: string;
  style: Record<string, unknown>;
  dataset?: Record<string, string>;
  setAttribute?: (name: string, value: string) => void;
};

type OverlayDocument<TElement extends OverlayElement = HTMLElement> = {
  createElement(tagName: string): TElement;
};

interface HoverSelectorPillOptions {
  tagLabel: string;
  selectorLabel: string;
}

interface NotePreviewCardShellOptions {
  elementInfo: string;
  displayDate: string;
  title: string;
  previewText: string;
  tags: string[];
}

function setDataAttribute(element: OverlayElement, name: string, value: string) {
  if (element.dataset) {
    element.dataset[name] = value;
    return;
  }

  element.setAttribute?.(
    `data-${name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`,
    value
  );
}

function applyStyles(
  element: OverlayElement,
  styles: Record<string, string | undefined>
) {
  Object.assign(element.style as Record<string, string | undefined>, styles);
}

function createTextElement<TElement extends OverlayElement>(
  documentRef: OverlayDocument<TElement>,
  tagName: string,
  text: string,
  dataName?: string
) {
  const element = documentRef.createElement(tagName);
  element.textContent = text;
  if (dataName) {
    setDataAttribute(element, dataName, 'true');
  }
  return element;
}

function createPreviewActionButton<TElement extends OverlayElement>(
  documentRef: OverlayDocument<TElement>,
  label: string,
  dataName: string,
  destructive = false
) {
  const button = createTextElement(documentRef, 'button', label, dataName);
  applyStyles(button, {
    minWidth: '74px',
    height: '36px',
    padding: '0 14px',
    borderRadius: '12px',
    border: destructive
      ? '1px solid oklch(0.704 0.191 22.216 / 0.16)'
      : '1px solid oklch(1 0 0 / 10%)',
    background: destructive
      ? 'oklch(0.704 0.191 22.216 / 0.14)'
      : 'oklch(0.274 0.006 286.033)',
    color: destructive ? 'oklch(0.704 0.191 22.216)' : 'oklch(0.987 0.002 197.1)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Inter Variable, system-ui, sans-serif',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  });
  return button;
}

export function createHoverSelectorPill<TElement extends OverlayElement>(
  documentRef: OverlayDocument<TElement>,
  options: HoverSelectorPillOptions
) {
  const pill = documentRef.createElement('div');
  pill.className = 'canopy-selector-pill';
  setDataAttribute(pill, 'canopyOverlay', 'selector-pill');
  applyStyles(pill, {
    position: 'fixed',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    maxWidth: 'min(520px, calc(100vw - 24px))',
    padding: '8px 10px',
    borderRadius: '999px',
    background: 'oklch(0.148 0.004 228.8 / 0.96)',
    color: 'oklch(0.979 0.021 166.113)',
    border: '1px solid oklch(0.865 0.127 207.078 / 0.18)',
    boxShadow: '0 10px 30px oklch(0.148 0.004 228.8 / 0.22)',
    fontFamily: 'Inter Variable, system-ui, sans-serif',
    fontSize: '12px',
    lineHeight: '1.2',
    zIndex: '2147483646',
    pointerEvents: 'none',
  });

  const tag = createTextElement(documentRef, 'span', options.tagLabel, 'canopyTag');
  applyStyles(tag, {
    flexShrink: '0',
    padding: '4px 8px',
    borderRadius: '999px',
    background: 'oklch(0.865 0.127 207.078 / 0.14)',
    color: 'oklch(0.865 0.127 207.078)',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.08em',
  });

  const selector = createTextElement(
    documentRef,
    'span',
    options.selectorLabel,
    'canopySelector'
  );
  applyStyles(selector, {
    minWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily:
      "'SF Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: '11px',
    color: 'oklch(0.979 0.021 166.113 / 0.84)',
  });

  pill.appendChild(tag);
  pill.appendChild(selector);
  return pill;
}

export function createSelectorGuide<TElement extends OverlayElement>(
  documentRef: OverlayDocument<TElement>,
  text: string
) {
  const pill = documentRef.createElement('div');
  pill.className = 'canopy-selector-guide';
  pill.textContent = text;
  setDataAttribute(pill, 'canopyOverlay', 'selector-guide');
  applyStyles(pill, {
    position: 'fixed',
    left: '50%',
    bottom: '18px',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    maxWidth: 'min(540px, calc(100vw - 24px))',
    padding: '10px 16px',
    borderRadius: '999px',
    background: 'oklch(0.148 0.004 228.8 / 0.96)',
    color: 'oklch(0.979 0.021 166.113)',
    border: '1px solid oklch(0.865 0.127 207.078 / 0.16)',
    boxShadow: '0 12px 36px oklch(0.148 0.004 228.8 / 0.24)',
    fontFamily: 'Inter Variable, system-ui, sans-serif',
    fontSize: '13px',
    fontWeight: '500',
    letterSpacing: '0.01em',
    zIndex: '2147483647',
    pointerEvents: 'auto',
  });
  return pill;
}

export function createSelectionConfirmationPill<TElement extends OverlayElement>(
  documentRef: OverlayDocument<TElement>,
  text: string
) {
  const pill = createSelectorGuide(documentRef, text);
  pill.className = 'canopy-selector-confirmation';
  setDataAttribute(pill, 'canopyOverlay', 'selector-confirmation');
  applyStyles(pill, {
    background: 'oklch(0.508 0.118 165.612 / 0.98)',
    border: '1px solid oklch(0.865 0.127 207.078 / 0.26)',
    boxShadow: '0 12px 36px oklch(0.148 0.004 228.8 / 0.28)',
  });
  return pill;
}

export function createPlacedNoteBadge<TElement extends OverlayElement>(
  documentRef: OverlayDocument<TElement>,
  label = '1'
) {
  const badge = documentRef.createElement('div');
  badge.className = 'canopy-badge';
  badge.title = 'DivNotes note';
  badge.textContent = label;
  setDataAttribute(badge, 'canopyOverlay', 'placed-note-badge');
  applyStyles(badge, {
    position: 'fixed',
    width: '22px',
    height: '22px',
    borderRadius: '7px',
    background: 'oklch(0.148 0.004 228.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: '2147483645',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    animation: 'canopy-pulse 2s infinite, canopy-fadein 0.25s ease-out',
    boxShadow: '0 2px 8px oklch(0.148 0.004 228.8 / 0.2)',
    pointerEvents: 'auto',
    fontSize: '10px',
    fontWeight: '700',
    color: 'oklch(0.865 0.127 207.078)',
    fontFamily: 'Inter Variable, system-ui, sans-serif',
  });
  return badge;
}

export function createPageNoteCountPill<TElement extends OverlayElement>(
  documentRef: OverlayDocument<TElement>,
  noteCount: number
) {
  const pill = documentRef.createElement('div');
  pill.className = 'canopy-page-note-count';
  pill.textContent = `${noteCount} ${noteCount === 1 ? 'note' : 'notes'} on this page`;
  setDataAttribute(pill, 'canopyOverlay', 'page-note-count');
  applyStyles(pill, {
    position: 'fixed',
    right: '16px',
    bottom: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '34px',
    padding: '0 14px',
    borderRadius: '999px',
    background: 'oklch(0.148 0.004 228.8 / 0.94)',
    color: 'oklch(0.979 0.021 166.113)',
    border: '1px solid oklch(0.865 0.127 207.078 / 0.14)',
    boxShadow: '0 12px 32px oklch(0.148 0.004 228.8 / 0.18)',
    fontFamily: 'Inter Variable, system-ui, sans-serif',
    fontSize: '12px',
    fontWeight: '500',
    zIndex: '2147483644',
    pointerEvents: 'none',
  });
  return pill;
}

export function createNotePreviewCardShell<TElement extends OverlayElement>(
  documentRef: OverlayDocument<TElement>,
  options: NotePreviewCardShellOptions
) {
  const card = documentRef.createElement('div');
  card.className = 'canopy-note-card';
  setDataAttribute(card, 'canopyOverlay', 'note-preview-card');
  applyStyles(card, {
    position: 'fixed',
    width: '340px',
    zIndex: '2147483646',
    fontFamily: 'Inter Variable, system-ui, sans-serif',
    animation: 'canopy-fadein 0.15s ease-out',
    pointerEvents: 'auto',
  });

  const panel = documentRef.createElement('div');
  setDataAttribute(panel, 'canopyPreviewPanel', '');
  applyStyles(panel, {
    background: 'oklch(0.218 0.008 223.9)',
    border: '1px solid oklch(1 0 0 / 10%)',
    borderRadius: '22px',
    boxShadow: '0 24px 72px oklch(0 0 0 / 0.34)',
    overflow: 'hidden',
    width: '340px',
  });

  const body = documentRef.createElement('div');
  applyStyles(body, {
    padding: '18px 18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  });

  const previewBody = createTextElement(
    documentRef,
    'div',
    options.previewText,
    'canopyPreviewBody'
  );
  applyStyles(previewBody, {
    fontSize: '14px',
    lineHeight: '1.75',
    color: 'oklch(0.987 0.002 197.1)',
    maxHeight: '200px',
    overflowY: 'auto',
  });

  const tags = createTextElement(documentRef, 'div', '', 'canopyPreviewTags');
  applyStyles(tags, {
    display: options.tags.length > 0 ? 'flex' : 'none',
    flexWrap: 'wrap',
    gap: '8px',
  });

  options.tags.forEach((tag) => {
    const chip = createTextElement(documentRef, 'span', `#${tag}`, 'canopyPreviewTagChip');
    applyStyles(chip, {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '7px 11px',
      borderRadius: '999px',
      background: 'oklch(0.432 0.095 166.913 / 0.14)',
      color: 'oklch(0.432 0.095 166.913)',
      fontSize: '11px',
      fontWeight: '800',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    });
    tags.appendChild(chip);
  });

  body.appendChild(previewBody);
  body.appendChild(tags);

  const actions = documentRef.createElement('div');
  applyStyles(actions, {
    padding: '14px 16px 16px',
    borderTop: '1px solid oklch(1 0 0 / 10%)',
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  });

  const moveButton = createPreviewActionButton(documentRef, 'Move', 'canopyMove');
  const editButton = createPreviewActionButton(documentRef, 'Edit', 'canopyEdit');
  const deleteButton = createPreviewActionButton(
    documentRef,
    'Delete',
    'canopyDelete',
    true
  );

  actions.appendChild(moveButton);
  actions.appendChild(editButton);
  actions.appendChild(deleteButton);

  panel.appendChild(body);
  panel.appendChild(actions);
  card.appendChild(panel);

  return card;
}
