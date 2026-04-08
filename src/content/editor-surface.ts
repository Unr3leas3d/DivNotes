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
  button.style.cssText = [
    'all:initial',
    'box-sizing:border-box',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'font-family:Inter Variable,system-ui,sans-serif',
    'line-height:1',
    'appearance:none',
    '-webkit-appearance:none',
    styleText,
  ].join(';');
  return button;
}

export function createEditorShell(doc: EditorSurfaceDocument) {
  const shell = applyDataAttr(doc.createElement('div'), 'canopy-editor-shell');
  shell.style.cssText = [
    'all:initial',
    'box-sizing:border-box',
    'display:block',
    'font-family:Inter Variable,system-ui,sans-serif',
    'color:oklch(0.987 0.002 197.1)',
    'line-height:1.4',
    'background:oklch(0.218 0.008 223.9)',
    'border:1px solid oklch(1 0 0 / 10%)',
    'border-radius:20px',
    'box-shadow:0 22px 64px oklch(0 0 0 / 0.34)',
    'overflow:hidden',
    'animation:canopy-fadein 0.15s ease-out',
  ].join(';');
  return shell;
}

export function createEditorHeader(doc: EditorSurfaceDocument, state: EditorSurfaceState) {
  const header = applyDataAttr(doc.createElement('div'), 'canopy-editor-header');
  header.style.cssText =
    'padding:12px 12px 11px;border-bottom:1px solid oklch(1 0 0 / 10%);display:flex;align-items:center;justify-content:space-between;gap:10px;';

  const infoBlock = doc.createElement('div');
  infoBlock.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;flex:1;';

  const accent = doc.createElement('div');
  accent.style.cssText =
    'width:28px;height:28px;border-radius:10px;background:linear-gradient(135deg, oklch(0.432 0.095 166.913), oklch(0.56 0.12 176));flex-shrink:0;box-shadow:0 8px 16px oklch(0.432 0.095 166.913 / 0.16);';

  const textBlock = doc.createElement('div');
  textBlock.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;';

  const heading = applyDataAttr(doc.createElement('span'), 'canopy-editor-heading');
  heading.textContent = state.isNew ? 'New note' : 'Edit note';
  heading.style.cssText = 'font-size:18px;font-weight:700;line-height:1;color:oklch(0.987 0.002 197.1);letter-spacing:-0.03em;';

  const subheading = doc.createElement('span');
  subheading.textContent = 'Anchored to selection';
  subheading.style.cssText =
    'font-size:9px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:oklch(0.723 0.014 214.4);';

  appendChildren(textBlock, [heading, subheading]);
  appendChildren(infoBlock, [accent, textBlock]);

  const actions = doc.createElement('div');
  actions.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

  if (!state.isNew) {
    actions.appendChild(
      createButton(
        doc,
        'Delete',
        'canopy-delete',
        'height:34px;padding:0 12px;border:1px solid oklch(0.704 0.191 22.216 / 0.16);border-radius:11px;background:oklch(0.704 0.191 22.216 / 0.14);color:oklch(0.704 0.191 22.216);font-size:12px;font-weight:700;cursor:pointer;'
      )
    );
  }

  actions.appendChild(
    createButton(
      doc,
      'Close',
      'canopy-close',
      'height:34px;padding:0 12px;border:1px solid oklch(1 0 0 / 10%);border-radius:11px;background:oklch(0.274 0.006 286.033);color:oklch(0.987 0.002 197.1);font-size:12px;font-weight:700;cursor:pointer;'
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
    'all:initial',
    'width:100%',
    'min-height:180px',
    'max-height:264px',
    'box-sizing:border-box',
    'padding:12px',
    'border:1px solid oklch(1 0 0 / 15%)',
    'border-radius:16px',
    'background:oklch(0.148 0.004 228.8 / 0.62)',
    'font-family:Inter Variable,system-ui,sans-serif',
    'font-size:13px',
    'line-height:1.65',
    'color:oklch(0.987 0.002 197.1)',
    'outline:none',
    'box-shadow:0 0 0 3px oklch(0.56 0.021 213.5 / 0.12)',
    'transition:border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
    'resize:vertical',
  ].join(';');

  wrapper.appendChild(textarea);
  return wrapper;
}

export function createFolderControl(doc: EditorSurfaceDocument, folderLabel: string) {
  const row = applyDataAttr(doc.createElement('div'), 'canopy-folder-control');
  row.style.cssText =
    'margin:0 12px;padding:10px 11px;border-radius:14px;background:oklch(0.274 0.006 286.033);border:1px solid oklch(1 0 0 / 10%);';

  const rowTop = doc.createElement('div');
  rowTop.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;';

  const infoBlock = doc.createElement('div');
  infoBlock.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;';

  const metaLabel = doc.createElement('span');
  metaLabel.textContent = 'Folder';
  metaLabel.style.cssText =
    'font-size:10px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:oklch(0.723 0.014 214.4);';

  const label = applyDataAttr(doc.createElement('span'), 'canopy-folder-label');
  label.textContent = folderLabel;
  label.style.cssText =
    'font-size:12px;font-weight:700;color:oklch(0.987 0.002 197.1);';

  const changeButton = createButton(
    doc,
    'Change',
    'canopy-folder-change',
    'padding:0;border:none;background:transparent;color:oklch(0.432 0.095 166.913);font-size:12px;font-weight:700;cursor:pointer;'
  );

  appendChildren(infoBlock, [metaLabel, label]);
  appendChildren(rowTop, [infoBlock, changeButton]);
  row.appendChild(rowTop);
  return row;
}

export function createTagRow(doc: EditorSurfaceDocument, tagLabels: readonly string[]) {
  const row = applyDataAttr(doc.createElement('div'), 'canopy-tag-row');
  row.style.cssText =
    'display:flex;flex-direction:column;gap:10px;margin:10px 12px 0;padding:10px 11px;border-radius:14px;background:oklch(0.274 0.006 286.033);border:1px solid oklch(1 0 0 / 10%);';

  const header = doc.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;';

  const metaCopy = doc.createElement('div');
  metaCopy.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;';

  const metaLabel = doc.createElement('span');
  metaLabel.textContent = 'Tags';
  metaLabel.style.cssText =
    'font-size:10px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:oklch(0.723 0.014 214.4);';

  const metaValue = doc.createElement('span');
  metaValue.textContent = tagLabels.length > 0 ? tagLabels.join(', ') : 'No tags yet';
  metaValue.style.cssText = 'font-size:12px;font-weight:700;color:oklch(0.987 0.002 197.1);';

  appendChildren(metaCopy, [metaLabel, metaValue]);

  const addTagButton = createButton(
    doc,
    '+ Tag',
    'canopy-add-tag',
    'padding:0;border:none;background:transparent;color:oklch(0.432 0.095 166.913);font-size:12px;font-weight:700;cursor:pointer;'
  );

  appendChildren(header, [metaCopy, addTagButton]);

  const chips = doc.createElement('div');
  chips.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

  tagLabels.forEach((tagLabel) => {
    const chip = applyDataAttr(doc.createElement('span'), 'canopy-tag-chip');
    chip.textContent = tagLabel;
    chip.style.cssText =
      'display:inline-flex;align-items:center;padding:6px 9px;border-radius:999px;background:oklch(0.432 0.095 166.913 / 0.14);font-size:10px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:oklch(0.432 0.095 166.913);';
    chips.appendChild(chip);
  });

  const tagInput = doc.createElement('input');
  tagInput.setAttribute('data-canopy-tag-input', '');
  tagInput.setAttribute('type', 'text');
  tagInput.setAttribute('placeholder', 'tag name');
  tagInput.style.cssText =
    'all:initial;display:none;box-sizing:border-box;padding:7px 9px;border:1px solid oklch(1 0 0 / 15%);border-radius:10px;font-family:Inter Variable,system-ui,sans-serif;font-size:11px;line-height:1.3;color:oklch(0.987 0.002 197.1);background:oklch(0.148 0.004 228.8 / 0.62);appearance:none;-webkit-appearance:none;outline:none;box-shadow:none;transition:border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;width:120px;';

  const confirmButton = createButton(
    doc,
    'Add tag',
    'canopy-add-tag-confirm',
    'display:none;height:32px;padding:0 12px;border:1px solid oklch(1 0 0 / 10%);background:oklch(0.148 0.004 228.8 / 0.34);color:oklch(0.432 0.095 166.913);font-size:11px;font-weight:700;border-radius:10px;cursor:pointer;'
  );

  const inputRow = doc.createElement('div');
  inputRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
  appendChildren(inputRow, [tagInput, confirmButton]);

  appendChildren(row, [header, chips, inputRow]);

  return row;
}

export function createPinnedRow(doc: EditorSurfaceDocument, pinned: boolean) {
  const row = applyDataAttr(doc.createElement('div'), 'canopy-pinned-row');
  row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 12px 0;color:oklch(0.987 0.002 197.1);font-size:13px;';

  const input = applyDataAttr(doc.createElement('input'), 'canopy-pinned-input');
  input.setAttribute('type', 'checkbox');
  input.checked = pinned;
  input.style.cssText =
    'all:initial;display:inline-block;box-sizing:border-box;width:16px;height:16px;margin:0;accent-color:oklch(0.432 0.095 166.913);appearance:auto;-webkit-appearance:checkbox;cursor:pointer;';

  const label = doc.createElement('span');
  label.textContent = 'Pinned';
  label.style.cssText = 'font-size:13px;color:oklch(0.987 0.002 197.1);';

  appendChildren(row, [input, label]);
  return row;
}

export function createInlineErrorText(doc: EditorSurfaceDocument, errorMessage: string) {
  const error = applyDataAttr(doc.createElement('div'), 'canopy-error');
  error.textContent = errorMessage;
  error.style.cssText = 'min-height:16px;padding:10px 12px 0;font-size:10px;color:oklch(0.704 0.191 22.216);';
  return error;
}

export function createPrimarySaveButton(doc: EditorSurfaceDocument, state: EditorSurfaceState) {
  const button = createButton(
    doc,
    state.isNew ? 'Save Note' : 'Update Note',
    'canopy-save',
    [
      'padding:0 16px',
      'min-width:112px',
      'height:40px',
      'font-size:13px',
      'font-weight:800',
      'border:none',
      'border-radius:12px',
      `background:${state.saveDisabled ? 'oklch(0.148 0.004 228.8 / 0.18)' : 'oklch(0.432 0.095 166.913)'}`,
      `color:${state.saveDisabled ? 'oklch(0.723 0.014 214.4)' : 'oklch(0.979 0.021 166.113)'}`,
      `cursor:${state.saveDisabled ? 'not-allowed' : 'pointer'}`,
      `opacity:${state.saveDisabled ? '0.5' : '1'}`,
      `box-shadow:${state.saveDisabled ? 'none' : '0 14px 26px oklch(0.432 0.095 166.913 / 0.18)'}`,
    ].join(';')
  );
  button.disabled = state.saveDisabled;
  return button;
}

function createFooter(doc: EditorSurfaceDocument, state: EditorSurfaceState) {
  const footer = applyDataAttr(doc.createElement('div'), 'canopy-footer');
  footer.style.cssText =
    'padding:0 12px 12px;display:flex;align-items:center;justify-content:flex-end;gap:8px;';

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
