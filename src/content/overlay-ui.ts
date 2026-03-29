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
    background: 'rgba(5,36,21,0.96)',
    color: '#F5EFE9',
    border: '1px solid rgba(171,255,192,0.18)',
    boxShadow: '0 10px 30px rgba(5,36,21,0.22)',
    fontFamily: 'system-ui, sans-serif',
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
    background: 'rgba(171,255,192,0.14)',
    color: '#ABFFC0',
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
    color: 'rgba(245,239,233,0.84)',
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
    background: 'rgba(5,36,21,0.96)',
    color: '#F5EFE9',
    border: '1px solid rgba(171,255,192,0.16)',
    boxShadow: '0 12px 36px rgba(5,36,21,0.24)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    fontWeight: '500',
    letterSpacing: '0.01em',
    zIndex: '2147483647',
    pointerEvents: 'none',
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
    background: 'rgba(26,92,46,0.98)',
    border: '1px solid rgba(171,255,192,0.26)',
    boxShadow: '0 12px 36px rgba(5,36,21,0.28)',
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
    background: '#052415',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: '2147483645',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    animation: 'canopy-pulse 2s infinite, canopy-fadein 0.25s ease-out',
    boxShadow: '0 2px 8px rgba(5,36,21,0.2)',
    pointerEvents: 'auto',
    fontSize: '10px',
    fontWeight: '700',
    color: '#ABFFC0',
    fontFamily: 'system-ui, sans-serif',
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
    background: 'rgba(5,36,21,0.94)',
    color: '#F5EFE9',
    border: '1px solid rgba(171,255,192,0.14)',
    boxShadow: '0 12px 32px rgba(5,36,21,0.18)',
    fontFamily: 'system-ui, sans-serif',
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
    fontFamily: 'system-ui, sans-serif',
    animation: 'canopy-fadein 0.15s ease-out',
    pointerEvents: 'auto',
  });

  const panel = documentRef.createElement('div');
  applyStyles(panel, {
    background: '#FAFAF7',
    border: '1px solid rgba(5,36,21,0.06)',
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(5,36,21,0.12)',
    overflow: 'hidden',
    width: '340px',
  });

  const header = documentRef.createElement('div');
  applyStyles(header, {
    padding: '10px 14px',
    borderBottom: '1px solid rgba(5,36,21,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  });

  const elementInfo = createTextElement(
    documentRef,
    'span',
    options.elementInfo,
    'canopyElementInfo'
  );
  applyStyles(elementInfo, {
    fontSize: '10px',
    fontFamily:
      "'SF Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    color: '#7a8a7d',
    background: 'rgba(5,36,21,0.04)',
    padding: '2px 6px',
    borderRadius: '3px',
  });

  const date = createTextElement(
    documentRef,
    'span',
    options.displayDate,
    'canopyPreviewDate'
  );
  applyStyles(date, {
    fontSize: '10px',
    color: '#7a8a7d',
    flexShrink: '0',
  });

  header.appendChild(elementInfo);
  header.appendChild(date);

  const body = documentRef.createElement('div');
  applyStyles(body, {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  });

  const title = createTextElement(
    documentRef,
    'div',
    options.title,
    'canopyPreviewTitle'
  );
  applyStyles(title, {
    fontSize: '13px',
    fontWeight: '600',
    color: '#052415',
  });

  const previewBody = createTextElement(
    documentRef,
    'div',
    options.previewText,
    'canopyPreviewBody'
  );
  applyStyles(previewBody, {
    fontSize: '13px',
    lineHeight: '1.7',
    color: '#052415',
    maxHeight: '200px',
    overflowY: 'auto',
  });

  const tags = createTextElement(
    documentRef,
    'div',
    options.tags.map((tag) => `#${tag}`).join(' '),
    'canopyPreviewTags'
  );
  applyStyles(tags, {
    fontSize: '11px',
    lineHeight: '1.5',
    color: '#1a5c2e',
    display: options.tags.length > 0 ? 'block' : 'none',
  });

  body.appendChild(title);
  body.appendChild(previewBody);
  body.appendChild(tags);

  const actions = documentRef.createElement('div');
  applyStyles(actions, {
    padding: '8px 14px',
    borderTop: '1px solid rgba(5,36,21,0.06)',
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  });

  const moveButton = createTextElement(documentRef, 'button', 'Move', 'canopyMove');
  const editButton = createTextElement(documentRef, 'button', 'Edit', 'canopyEdit');
  const deleteButton = createTextElement(documentRef, 'button', 'Delete', 'canopyDelete');

  for (const button of [moveButton, editButton]) {
    applyStyles(button, {
      fontSize: '11px',
      color: '#7a8a7d',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '4px 10px',
      borderRadius: '4px',
      fontFamily: 'system-ui, sans-serif',
    });
  }

  applyStyles(deleteButton, {
    fontSize: '11px',
    color: '#dc2626',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: '4px',
    fontFamily: 'system-ui, sans-serif',
    opacity: '0.7',
  });

  actions.appendChild(moveButton);
  actions.appendChild(editButton);
  actions.appendChild(deleteButton);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(actions);
  card.appendChild(panel);

  return card;
}
