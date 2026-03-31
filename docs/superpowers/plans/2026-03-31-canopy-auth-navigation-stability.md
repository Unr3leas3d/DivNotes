# Canopy Auth And Note-Navigation Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Google sign-in reliable in real extension use, make note navigation survive cross-page and SPA transitions, rename navigation actions to `Go to note`, and remove the remaining browser prompt flow from content note interactions.

**Architecture:** Keep the Chrome Identity plus Supabase auth helper from batch 1, but add better runtime diagnostics and explicit verification around the real extension redirect flow. Replace direct popup-to-content `SCROLL_TO_NOTE` messages with a background-coordinated note-target message that can survive navigation, then extract content-side target lookup into a reusable helper that tries normalized URL, selector, XPath, text hash, and structural position in order.

**Tech Stack:** TypeScript, plain MV3 service worker JavaScript, Chrome Extension APIs (`chrome.identity`, `chrome.tabs`, `chrome.storage.session` or in-worker state), Supabase Auth, Node `node:test`

---

## Preflight Notes

- Batch 1 already introduced `signInWithGoogleInExtension()`. This plan should harden that path, not replace it again.
- The current cross-page note-navigation bug is architectural: popup and sidepanel throw away the note payload when they navigate the tab to another URL.
- This plan must include a manual external checkpoint for the real extension redirect URL and Supabase allowlist.
- The remaining browser prompt in current scope is the content-editor tag prompt at `src/content/index.tsx:924`.

## File Map

- `src/lib/google-auth.ts`
  Tighten Google auth error handling where runtime diagnostics or malformed callbacks still need clearer failures.
- `src/lib/google-auth.test.mjs`
  Add coverage for runtime error surfacing and callback parsing edge cases.
- `src/popup/LoginForm.tsx`
  Surface actionable inline auth errors and keep the button state resilient through real extension auth failures.
- `src/popup/App.tsx`
  Preserve auth rehydration behavior after Google login and guard against stale promotion or duplicate popup state transitions.
- `src/background/service-worker.js`
  Add a new background note-navigation flow that can navigate first and message the content script after the page is ready.
- `src/background/service-worker.test.js`
  Regression coverage for the new background note-target flow.
- `src/content/note-targeting.ts`
  New pure helper for normalized URL comparison and element lookup fallback order.
- `src/content/note-targeting.test.ts`
  Unit tests for selector, XPath, text-hash, and structural-position target resolution.
- `src/content/index.tsx`
  Consume the background note-target message, reuse the pure targeting helper, and remove the `window.prompt` tag flow.
- `src/content/editor-surface.ts`
  Add the minimal inline tag-entry affordance needed to replace the browser prompt.
- `src/content/editor-surface.test.ts`
  Regression coverage for the inline tag-entry control.
- `src/popup/Dashboard.tsx`
  Replace direct `SCROLL_TO_NOTE` messages with the background-coordinated note-target flow.
- `src/sidepanel/App.tsx`
  Replace direct `SCROLL_TO_NOTE` messages with the background-coordinated note-target flow.
- `src/components/workspace/WorkspaceNoteCard.tsx`
  Rename `Scroll to element` or equivalent navigation copy to `Go to note`.
- `src/sidepanel/components/NoteCard.tsx`
  Keep the expanded action bar aligned with the new `Go to note` label.
- `tests/canopy-auth-navigation-stability.test.mjs`
  New source-inspection regression suite for auth diagnostics, background navigation flow, and prompt removal.

### Task 1: Harden The Google Auth Runtime Path

**Files:**
- Create: `tests/canopy-auth-navigation-stability.test.mjs`
- Modify: `src/lib/google-auth.ts`
- Modify: `src/lib/google-auth.test.mjs`
- Modify: `src/popup/LoginForm.tsx`
- Modify: `src/popup/App.tsx`

- [ ] **Step 1: Add failing auth regression checks**

```js
test('popup Google auth surfaces actionable inline failures', () => {
  const loginForm = read('src/popup/LoginForm.tsx');
  const googleAuth = read('src/lib/google-auth.ts');

  assert.ok(googleAuth.includes('chrome.identity'));
  assert.ok(googleAuth.includes('Google sign-in could not be started.'));
  assert.ok(loginForm.includes('Google sign-in failed'));
  assert.ok(loginForm.includes('onGoogleSessionPromotionChange(false)'));
});
```

- [ ] **Step 2: Add one new unit test for a runtime error path**

```js
test('signInWithGoogleInExtension surfaces signInWithOAuth startup failures', async () => {
  await assert.rejects(
    signInWithGoogleInExtension({
      getRedirectURL: () => 'https://extension-id.chromiumapp.org/',
      signInWithOAuth: async () => ({ data: { url: null }, error: new Error('provider disabled') }),
      launchWebAuthFlow: async () => undefined,
      exchangeCodeForSession: async () => ({ data: { user: null }, error: null }),
    }),
    /provider disabled/i
  );
});
```

- [ ] **Step 3: Run the auth tests to verify they fail**

Run: `node --test src/lib/google-auth.test.mjs tests/canopy-auth-navigation-stability.test.mjs`

Expected: FAIL because the new runtime-error test and regression assertions are not satisfied yet.

- [ ] **Step 4: Implement the minimal auth hardening**

Minimum acceptable behavior:

- startup failures from `signInWithOAuth()` remain user-visible as inline popup errors
- duplicate Google clicks stay disabled during the flow
- popup auth promotion is reset cleanly on every failure path
- runtime errors remain specific enough to debug real extension misconfiguration

- [ ] **Step 5: Re-run the auth tests**

Run: `node --test src/lib/google-auth.test.mjs tests/canopy-auth-navigation-stability.test.mjs`

Expected: PASS

- [ ] **Step 6: Commit the auth hardening**

```bash
git add src/lib/google-auth.ts src/lib/google-auth.test.mjs src/popup/LoginForm.tsx src/popup/App.tsx tests/canopy-auth-navigation-stability.test.mjs
git commit -m "fix: harden extension google auth handling"
```

### Task 2: Add Background-Coordinated Note Navigation

**Files:**
- Modify: `src/background/service-worker.js`
- Modify: `src/background/service-worker.test.js`
- Modify: `src/popup/Dashboard.tsx`
- Modify: `src/sidepanel/App.tsx`
- Modify: `tests/canopy-auth-navigation-stability.test.mjs`

- [ ] **Step 1: Add failing regression checks for the new message contract**

```js
test('workspace surfaces delegate note navigation through the background worker', () => {
  const popupDashboard = read('src/popup/Dashboard.tsx');
  const sidepanelApp = read('src/sidepanel/App.tsx');
  const serviceWorker = read('src/background/service-worker.js');

  assert.ok(popupDashboard.includes("type: 'OPEN_NOTE_TARGET'"));
  assert.ok(sidepanelApp.includes("type: 'OPEN_NOTE_TARGET'"));
  assert.ok(serviceWorker.includes("if (message.type === 'OPEN_NOTE_TARGET')"));
  assert.ok(serviceWorker.includes('chrome.tabs.onUpdated.addListener'));
});
```

- [ ] **Step 2: Add a service-worker unit test for delayed note targeting**

```js
test('OPEN_NOTE_TARGET navigates and replays the note target after tab load', async () => {
  const [messageHandler] = chrome.runtime.onMessage.listeners;
  const tabId = 12;

  await new Promise((resolve) => {
    messageHandler(
      { type: 'OPEN_NOTE_TARGET', note: { url: 'https://ign.com/article', elementSelector: '#headline' } },
      { tab: { id: tabId, windowId: 1 } },
      resolve
    );
  });

  assert.equal(chrome.tabs.updateCalls[0].url, 'https://ign.com/article');
  assert.equal(chrome.tabs.onUpdated.listeners.length > 0, true);
});
```

- [ ] **Step 3: Run the background tests to verify they fail**

Run: `node --test src/background/service-worker.test.js tests/canopy-auth-navigation-stability.test.mjs`

Expected: FAIL because `OPEN_NOTE_TARGET` and its load-complete replay path do not exist yet.

- [ ] **Step 4: Implement the background navigation flow**

Use this contract:

```js
{
  type: 'OPEN_NOTE_TARGET',
  note: {
    url,
    elementSelector,
    elementXPath,
    elementTextHash,
    elementPosition,
    elementTag,
  }
}
```

Implementation rules:

- if the current tab already matches the normalized note URL, send the content message immediately
- if not, navigate the active tab first, cache the pending note target keyed by tab id, and replay `SCROLL_TO_NOTE` after the tab finishes loading
- clear the pending target once the message is delivered

- [ ] **Step 5: Re-run the background tests**

Run: `node --test src/background/service-worker.test.js tests/canopy-auth-navigation-stability.test.mjs`

Expected: PASS

- [ ] **Step 6: Commit the background note-navigation flow**

```bash
git add src/background/service-worker.js src/background/service-worker.test.js src/popup/Dashboard.tsx src/sidepanel/App.tsx tests/canopy-auth-navigation-stability.test.mjs
git commit -m "feat: route note navigation through the background worker"
```

### Task 3: Extract Content Target Resolution For SPA Pages

**Files:**
- Create: `src/content/note-targeting.ts`
- Create: `src/content/note-targeting.test.ts`
- Modify: `src/content/index.tsx`

- [ ] **Step 1: Write the failing target-resolution tests**

```ts
test('findMatchingElement tries selector, xpath, text hash, and structural position in order', () => {
  const element = findMatchingElement(fakeDocument, {
    url: 'https://ign.com/articles/foo',
    elementSelector: '.missing',
    elementXPath: '//*[@id="headline"]',
    elementTextHash: 'Launch coverage',
    elementPosition: '0,2,1',
    elementTag: 'h1',
  });

  assert.equal(element?.id, 'headline');
});

test('urlsMatchNoteTarget ignores trailing slashes and non-essential query noise', () => {
  assert.equal(urlsMatchNoteTarget('https://ign.com/article/', 'https://ign.com/article?utm=nav'), true);
});
```

- [ ] **Step 2: Run the new targeting tests to verify they fail**

Run: `node --test src/content/note-targeting.test.ts`

Expected: FAIL because the pure targeting module does not exist yet.

- [ ] **Step 3: Implement the pure content targeting helper**

```ts
export function urlsMatchNoteTarget(currentUrl: string, targetUrl: string) {
  const current = normalizeUrl(currentUrl);
  const target = normalizeUrl(targetUrl);
  return Boolean(current && target && current === target);
}

export function findMatchingElement(doc: Document, note: StoredNoteLike) {
  // selector -> xpath -> text hash -> structural position
}
```

Then update `src/content/index.tsx` so `SCROLL_TO_NOTE` uses this helper instead of `document.querySelector(message.selector)` directly.

- [ ] **Step 4: Re-run the content targeting tests**

Run: `node --test src/content/note-targeting.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the content target-resolution helper**

```bash
git add src/content/note-targeting.ts src/content/note-targeting.test.ts src/content/index.tsx
git commit -m "fix: add resilient content note target resolution"
```

### Task 4: Rename Navigation Copy And Remove The Remaining Browser Prompt

**Files:**
- Modify: `src/components/workspace/WorkspaceNoteCard.tsx`
- Modify: `src/sidepanel/components/NoteCard.tsx`
- Modify: `src/content/index.tsx`
- Modify: `src/content/editor-surface.ts`
- Modify: `src/content/editor-surface.test.ts`
- Modify: `tests/canopy-auth-navigation-stability.test.mjs`

- [ ] **Step 1: Add failing regression checks for copy and prompt removal**

```js
test('note navigation copy is renamed and content tag entry no longer uses window.prompt', () => {
  const workspaceCard = read('src/components/workspace/WorkspaceNoteCard.tsx');
  const sidepanelNoteCard = read('src/sidepanel/components/NoteCard.tsx');
  const contentIndex = read('src/content/index.tsx');
  const editorSurface = read('src/content/editor-surface.ts');

  assert.ok(sidepanelNoteCard.includes('Go to note'));
  assert.ok(!sidepanelNoteCard.includes('Scroll to element'));
  assert.ok(!contentIndex.includes('window.prompt'));
  assert.ok(editorSurface.includes('data-canopy-tag-input'));
});
```

- [ ] **Step 2: Extend the editor-surface tests first**

```ts
test('createEditorSurface renders inline tag entry controls instead of relying on browser prompts', () => {
  const surface = createEditorSurface(fakeDocument, sampleState);
  assert.equal(surface.querySelector('[data-canopy-tag-input]')?.tagName, 'INPUT');
  assert.equal(surface.querySelector('[data-canopy-add-tag-confirm]')?.textContent, 'Add tag');
});
```

- [ ] **Step 3: Run the regression tests to verify they fail**

Run: `node --test tests/canopy-auth-navigation-stability.test.mjs src/content/editor-surface.test.ts`

Expected: FAIL because `window.prompt` is still present and the editor does not expose inline tag-entry controls yet.

- [ ] **Step 4: Implement the copy rename and inline tag-entry flow**

Minimum acceptable behavior:

- every workspace navigation button reads `Go to note`
- adding a tag from the content editor uses an inline text field and confirm action
- the editor keeps keyboard focus inside the Canopy UI instead of opening a browser prompt

- [ ] **Step 5: Re-run the regression tests**

Run: `node --test tests/canopy-auth-navigation-stability.test.mjs src/content/editor-surface.test.ts`

Expected: PASS

- [ ] **Step 6: Commit the prompt removal and copy update**

```bash
git add src/components/workspace/WorkspaceNoteCard.tsx src/sidepanel/components/NoteCard.tsx src/content/index.tsx src/content/editor-surface.ts src/content/editor-surface.test.ts tests/canopy-auth-navigation-stability.test.mjs
git commit -m "fix: polish note navigation copy and content tag entry"
```

### Task 5: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run the focused auth and stability suite**

Run: `node --test src/lib/google-auth.test.mjs src/background/service-worker.test.js src/content/note-targeting.test.ts src/content/editor-surface.test.ts tests/canopy-auth-navigation-stability.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: exit code `0`

- [ ] **Step 3: Perform manual browser checks**

Verify in Chrome:

1. `Continue with Google` succeeds in the popup on the real unpacked extension.
2. `chrome.identity.getRedirectURL()` exactly matches a Supabase allowlisted redirect.
3. Clicking `Go to note` on the same page scrolls to and highlights the correct target.
4. Clicking `Go to note` for a note on another page navigates there and still opens the correct target after load.
5. A note on a React or SPA page such as IGN still resolves via XPath or fallback metadata when the CSS selector is stale.
6. Adding a tag in the content editor no longer opens a browser prompt.

- [ ] **Step 4: Commit any final fixes**

```bash
git add .
git commit -m "test: verify auth and note navigation stability"
```
