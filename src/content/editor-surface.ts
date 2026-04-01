type EditorSurfaceElement = {
  id: string;
  className: string;
  textContent: string | null;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  disabled?: boolean;
  type?: string;
  style: { cssText?: string; [key: string]: unknown };
  appendChild(child: EditorSurfaceElement): unknown;
  setAttribute(name: string, value: string): void;
};

type EditorSurfaceDocument = {
  createElement(tagName: string): EditorSurfaceElement;
};

export type EditorSurfaceState = {
  isNew: boolean;
  body: string;
  folderLabel: string;
  tagLabels: readonly string[];
  pinned: boolean;
  errorMessage: string;
  saveDisabled: boolean;
};

function appendChildren(parent: EditorSurfaceElement, children: EditorSurfaceElement[]) {
  children.forEach((child) => parent.appendChild(child));
}

function applyDataAttr(element: EditorSurfaceElement, key: string) {
  element.setAttribute(`data-${key}`, '');
  return element;
}

function createButton(
  doc: EditorSurfaceDocument,
  label: string,
  dataKey: string,
  styleText: string
) {
  const button = applyDataAttr(doc.createElement('button'), dataKey);
  button.textContent = label;
  button.style.cssText = styleText;
  return button;
}

export function createEditorShell(doc: EditorSurfaceDocument) {
  const shell = applyDataAttr(doc.createElement('div'), 'canopy-editor-shell');
  shell.style.cssText = [
    'background:#FAFAF7',
    'border:1px solid rgba(5,36,21,0.06)',
    'border-radius:14px',
    'box-shadow:0 8px 32px rgba(5,36,21,0.12)',
    'overflow:hidden',
    'animation:canopy-fadein 0.15s ease-out',
  ].join(';');
  return shell;
}

export function createEditorHeader(doc: EditorSurfaceDocument, state: EditorSurfaceState) {
  const header = applyDataAttr(doc.createElement('div'), 'canopy-editor-header');
  header.style.cssText =
    'padding:12px 16px;border-bottom:1px solid rgba(5,36,21,0.06);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;';

  const infoBlock = doc.createElement('div');
  infoBlock.style.cssText = 'display:flex;align-items:flex-start;gap:8px;min-width:0;flex:1;';

  const accent = doc.createElement('div');
  accent.style.cssText =
    'width:18px;height:18px;border-radius:6px;background:linear-gradient(135deg,#052415,#1a5c2e);flex-shrink:0;margin-top:1px;';

  const textBlock = doc.createElement('div');
  textBlock.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;';

  const heading = applyDataAttr(doc.createElement('span'), 'canopy-editor-heading');
  heading.textContent = state.isNew ? 'New note' : 'Edit note';
  heading.style.cssText = 'font-size:12px;font-weight:600;color:#052415;';

  textBlock.appendChild(heading);
  appendChildren(infoBlock, [accent, textBlock]);

  const actions = doc.createElement('div');
  actions.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';

  if (!state.isNew) {
    actions.appendChild(
      createButton(
        doc,
        'Delete',
        'canopy-delete',
        'padding:7px 12px;border:none;border-radius:10px;background:rgba(220,38,38,0.08);color:#b91c1c;font-size:12px;cursor:pointer;'
      )
    );
  }

  actions.appendChild(
    createButton(
      doc,
      'Close',
      'canopy-close',
      'padding:7px 12px;border:1px solid rgba(5,36,21,0.06);border-radius:10px;background:rgba(5,36,21,0.04);color:#7a8a7d;font-size:12px;cursor:pointer;'
    )
  );

  appendChildren(header, [infoBlock, actions]);
  return header;
}

export function createBodyTextarea(doc: EditorSurfaceDocument, value: string) {
  const wrapper = doc.createElement('div');
  wrapper.style.cssText = 'padding:12px;';

  const textarea = applyDataAttr(doc.createElement('textarea'), 'canopy-editor-body');
  textarea.setAttribute('placeholder', 'Write your note in Markdown...');
  textarea.value = value;
  textarea.style.cssText = [
    'width:100%',
    'min-height:140px',
    'max-height:300px',
    'box-sizing:border-box',
    'padding:12px',
    'border:1px solid rgba(5,36,21,0.1)',
    'border-radius:8px',
    'background:#FFFFFF',
    'font-size:13px',
    'line-height:1.6',
    'color:#052415',
    'resize:vertical',
  ].join(';');

  wrapper.appendChild(textarea);
  return wrapper;
}

export function createFolderControl(doc: EditorSurfaceDocument, folderLabel: string) {
  const row = applyDataAttr(doc.createElement('div'), 'canopy-folder-control');
  row.style.cssText =
    'display:flex;align-items:center;gap:8px;padding:0 12px 12px;border-bottom:1px solid rgba(5,36,21,0.06);';

  const label = applyDataAttr(doc.createElement('span'), 'canopy-folder-label');
  label.textContent = folderLabel;
  label.style.cssText =
    'font-size:11px;color:#052415;background:rgba(5,36,21,0.04);padding:4px 10px;border-radius:999px;';

  const changeButton = createButton(
    doc,
    'Change',
    'canopy-folder-change',
    'padding:4px 8px;border:none;background:none;color:#1a5c2e;font-size:11px;cursor:pointer;'
  );

  appendChildren(row, [label, changeButton]);
  return row;
}

export function createTagRow(doc: EditorSurfaceDocument, tagLabels: readonly string[]) {
  const row = applyDataAttr(doc.createElement('div'), 'canopy-tag-row');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:12px 12px 0;';

  tagLabels.forEach((tagLabel) => {
    const chip = applyDataAttr(doc.createElement('span'), 'canopy-tag-chip');
    chip.textContent = tagLabel;
    chip.style.cssText =
      'font-size:11px;color:#052415;background:rgba(171,255,192,0.28);padding:4px 8px;border-radius:999px;';
    row.appendChild(chip);
  });

  const addTagButton = createButton(
    doc,
    '+ Tag',
    'canopy-add-tag',
    'padding:4px 8px;border:none;background:none;color:#1a5c2e;font-size:11px;cursor:pointer;'
  );
  row.appendChild(addTagButton);

  const tagInput = doc.createElement('input');
  tagInput.setAttribute('data-canopy-tag-input', '');
  tagInput.setAttribute('type', 'text');
  tagInput.setAttribute('placeholder', 'tag name');
  tagInput.style.cssText =
    'display:none;padding:4px 8px;border:1px solid rgba(5,36,21,0.1);border-radius:6px;font-size:11px;color:#052415;width:100px;';
  row.appendChild(tagInput);

  const confirmButton = createButton(
    doc,
    'Add tag',
    'canopy-add-tag-confirm',
    'display:none;padding:4px 8px;border:none;background:rgba(5,36,21,0.08);color:#1a5c2e;font-size:11px;border-radius:6px;cursor:pointer;'
  );
  row.appendChild(confirmButton);

  return row;
}

export function createPinnedRow(doc: EditorSurfaceDocument, pinned: boolean) {
  const row = applyDataAttr(doc.createElement('div'), 'canopy-pinned-row');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 12px 0;';

  const input = applyDataAttr(doc.createElement('input'), 'canopy-pinned-input');
  input.setAttribute('type', 'checkbox');
  input.checked = pinned;

  const label = doc.createElement('span');
  label.textContent = 'Pinned';
  label.style.cssText = 'font-size:12px;color:#052415;';

  appendChildren(row, [input, label]);
  return row;
}

export function createInlineErrorText(doc: EditorSurfaceDocument, errorMessage: string) {
  const error = applyDataAttr(doc.createElement('div'), 'canopy-error');
  error.textContent = errorMessage;
  error.style.cssText = 'min-height:18px;padding:12px 12px 0;font-size:11px;color:#b91c1c;';
  return error;
}

export function createPrimarySaveButton(doc: EditorSurfaceDocument, state: EditorSurfaceState) {
  const button = createButton(
    doc,
    state.isNew ? 'Save Note' : 'Update Note',
    'canopy-save',
    [
      'padding:7px 20px',
      'font-size:12px',
      'font-weight:600',
      'border:none',
      'border-radius:10px',
      `background:${state.saveDisabled ? 'rgba(5,36,21,0.1)' : '#052415'}`,
      `color:${state.saveDisabled ? '#7a8a7d' : '#F5EFE9'}`,
      `cursor:${state.saveDisabled ? 'not-allowed' : 'pointer'}`,
      `opacity:${state.saveDisabled ? '0.5' : '1'}`,
    ].join(';')
  );
  button.disabled = state.saveDisabled;
  return button;
}

function createFooter(doc: EditorSurfaceDocument, state: EditorSurfaceState) {
  const footer = applyDataAttr(doc.createElement('div'), 'canopy-footer');
  footer.style.cssText =
    'padding:12px;display:flex;align-items:center;justify-content:flex-end;gap:8px;';

  const saveButton = createPrimarySaveButton(doc, state);
  footer.appendChild(saveButton);
  return footer;
}

export function createEditorSurface(doc: EditorSurfaceDocument, state: EditorSurfaceState) {
  const root = doc.createElement('div');
  root.id = 'canopy-root';

  const shell = createEditorShell(doc);
  appendChildren(shell, [
    createEditorHeader(doc, state),
    createBodyTextarea(doc, state.body),
    createFolderControl(doc, state.folderLabel),
    createTagRow(doc, state.tagLabels),
    createPinnedRow(doc, state.pinned),
    createInlineErrorText(doc, state.errorMessage),
    createFooter(doc, state),
  ]);

  root.appendChild(shell);
  return root;
}
