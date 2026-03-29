# Canopy Shell And Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Google sign-in for the extension and bring the popup and sidepanel shells into alignment with the approved batch-1 UX.

**Architecture:** Add a dedicated extension Google auth helper that uses Chrome Identity plus Supabase PKCE code exchange, then wire the popup login screen to it. Keep popup and sidepanel on the shared workspace hook, but enforce shell-specific root views and shell-specific layout contracts: sticky headers, independent scroll regions, popup sidepanel-launch icon, and a centered `720px` sidepanel work surface.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind CSS, Chrome Extension MV3 APIs (`chrome.identity`, `chrome.sidePanel`, `chrome.action`), Supabase Auth, Node `node:test`

---

## Preflight Notes

- Execute implementation in a dedicated worktree before touching production code.
- Use targeted Node tests and builds as the batch gate:
  - `node --test src/background/service-worker.test.js` currently passes.
  - `node --test tests/eden-bright-redesign.test.mjs` currently passes.
  - `npm run build` currently passes.
- Do **not** use `npx tsc --noEmit` as the completion gate for this batch. It is already red in the current repo for unrelated baseline issues in `src/content/*`, `src/components/ui/popover.tsx`, and a few existing tests.
- This batch includes an external Supabase configuration checkpoint:
  - add the exact value returned by `chrome.identity.getRedirectURL()` for the unpacked extension to the Supabase Auth redirect allowlist if it is not already present
  - confirm the Google auth provider remains enabled for the same project

## File Map

- `public/manifest.json`
  Add the MV3 `identity` permission needed for Chrome-managed OAuth handoff.
- `src/lib/supabase.ts`
  Enable PKCE flow on the shared Supabase client so auth codes from the Chrome identity callback can be exchanged into a stored session.
- `src/lib/google-auth.ts`
  New extension-auth helper with dependency injection for `signInWithOAuth`, `launchWebAuthFlow`, `exchangeCodeForSession`, and redirect URL generation.
- `src/lib/google-auth.test.mjs`
  New Node unit test for successful Google sign-in, cancellation handling, and malformed callback handling.
- `src/components/ui/dialog.tsx`
  New shared Radix dialog wrapper for in-app prompt/confirm flows.
- `src/components/workspace/WorkspaceActionDialog.tsx`
  New Canopy-styled prompt/confirm dialog with optional input, destructive actions, and inline validation messaging.
- `src/popup/LoginForm.tsx`
  Replace direct `supabase.auth.signInWithOAuth()` usage with the helper and apply the approved login copy/layout changes.
- `src/popup/components/PopupShell.tsx`
  Make the popup shell a fixed-height, sticky-header layout with a dedicated scroll body and support for two utility icons.
- `src/popup/Dashboard.tsx`
  Render popup header actions as sidepanel-launch plus settings, while preserving existing view/back behavior.
- `src/popup/App.tsx`
  Keep the popup frame at a fixed `380x500` shell height so the header/body scroll split is deterministic.
- `src/lib/use-extension-workspace.ts`
  Enforce shell-specific allowed root views and sanitize `setView()` calls so the sidepanel cannot route into `this-page`.
- `src/sidepanel/App.tsx`
  Remove `This Page`, remove the sidepanel “Open Popup” control, keep `Add note` primary, simplify search placeholders, convert settings clear-all to an in-app dialog, and keep settings/search aligned with the approved shell rules.
- `src/sidepanel/components/SegmentedControl.tsx`
  Reduce root navigation to `All Notes`, `Folders`, and `Tags`.
- `src/sidepanel/components/SidePanelShell.tsx`
  Preserve the sticky header but constrain the body to a centered `max-w-[720px]` working column.
- `src/sidepanel/components/FoldersView.tsx`
  Replace folder and bulk-action browser dialogs with the shared in-app dialog flow and inline errors.
- `src/sidepanel/components/TagManager.tsx`
  Replace tag delete/merge confirms with the shared in-app dialog flow.
- `tests/canopy-shell-login.test.mjs`
  New source-inspection regression coverage for manifest permission, popup login copy/layout, popup shell structure, dialog removal, sidepanel nav removal, and width guard behavior.
- `tests/eden-bright-redesign.test.mjs`
  Update the existing redesign regression suite so it stops asserting the obsolete popup/sidepanel behavior that this batch intentionally replaces.

### Task 1: Extension Google OAuth Helper

**Files:**
- Create: `src/lib/google-auth.ts`
- Create: `src/lib/google-auth.test.mjs`
- Modify: `src/lib/supabase.ts`
- Modify: `public/manifest.json`

- [ ] **Step 1: Write the failing auth-helper test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { signInWithGoogleInExtension } from './google-auth.ts';

test('signInWithGoogleInExtension launches Chrome OAuth and exchanges the returned code', async () => {
  let exchangedCode = '';

  const result = await signInWithGoogleInExtension({
    getRedirectURL: () => 'https://extension-id.chromiumapp.org/',
    signInWithOAuth: async (credentials) => {
      assert.deepEqual(credentials, {
        provider: 'google',
        options: {
          redirectTo: 'https://extension-id.chromiumapp.org/',
          skipBrowserRedirect: true,
        },
      });

      return {
        data: { provider: 'google', url: 'https://supabase.example/google-start' },
        error: null,
      };
    },
    launchWebAuthFlow: async ({ url, interactive }) => {
      assert.equal(url, 'https://supabase.example/google-start');
      assert.equal(interactive, true);
      return 'https://extension-id.chromiumapp.org/?code=oauth-code';
    },
    exchangeCodeForSession: async (code) => {
      exchangedCode = code;
      return {
        data: {
          user: { email: 'user@example.com' },
          session: { access_token: 'token', refresh_token: 'refresh' },
        },
        error: null,
      };
    },
  });

  assert.equal(exchangedCode, 'oauth-code');
  assert.equal(result.email, 'user@example.com');
});
```

- [ ] **Step 2: Add the error-path test cases before implementation**

```js
test('signInWithGoogleInExtension surfaces cancellation as an inline-safe error', async () => {
  await assert.rejects(
    signInWithGoogleInExtension({
      getRedirectURL: () => 'https://extension-id.chromiumapp.org/',
      signInWithOAuth: async () => ({
        data: { provider: 'google', url: 'https://supabase.example/google-start' },
        error: null,
      }),
      launchWebAuthFlow: async () => undefined,
      exchangeCodeForSession: async () => {
        throw new Error('should not run');
      },
    }),
    /cancelled/i
  );
});

test('signInWithGoogleInExtension rejects a callback with no auth code', async () => {
  await assert.rejects(
    signInWithGoogleInExtension({
      getRedirectURL: () => 'https://extension-id.chromiumapp.org/',
      signInWithOAuth: async () => ({
        data: { provider: 'google', url: 'https://supabase.example/google-start' },
        error: null,
      }),
      launchWebAuthFlow: async () => 'https://extension-id.chromiumapp.org/?state=missing-code',
      exchangeCodeForSession: async () => {
        throw new Error('should not run');
      },
    }),
    /authorization code/i
  );
});
```

- [ ] **Step 3: Run the auth-helper test to verify it fails**

Run: `node --test src/lib/google-auth.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` or `does not provide an export named 'signInWithGoogleInExtension'`

- [ ] **Step 4: Implement the minimal helper, PKCE client config, and manifest permission**

```ts
type LaunchWebAuthFlow = (details: { url: string; interactive: boolean }) => Promise<string | undefined>;

interface GoogleAuthDependencies {
  getRedirectURL: () => string;
  signInWithOAuth: (credentials: {
    provider: 'google';
    options: { redirectTo: string; skipBrowserRedirect: true };
  }) => Promise<{ data: { url: string | null }; error: Error | null }>;
  launchWebAuthFlow: LaunchWebAuthFlow;
  exchangeCodeForSession: (
    code: string
  ) => Promise<{ data: { user: { email?: string | null } | null }; error: Error | null }>;
}

export async function signInWithGoogleInExtension(deps: GoogleAuthDependencies) {
  const redirectTo = deps.getRedirectURL();
  const { data, error } = await deps.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    throw error ?? new Error('Google sign-in could not be started.');
  }

  const callbackUrl = await deps.launchWebAuthFlow({
    url: data.url,
    interactive: true,
  });

  if (!callbackUrl) {
    throw new Error('Google sign-in was cancelled.');
  }

  const parsed = new URL(callbackUrl);
  const callbackError =
    parsed.searchParams.get('error_description') || parsed.searchParams.get('error');
  if (callbackError) {
    throw new Error(callbackError);
  }

  const code = parsed.searchParams.get('code');
  if (!code) {
    throw new Error('Google sign-in did not return an authorization code.');
  }

  const { data: sessionData, error: exchangeError } = await deps.exchangeCodeForSession(code);
  if (exchangeError || !sessionData.user) {
    throw exchangeError ?? new Error('Google sign-in did not create a session.');
  }

  return { email: sessionData.user.email ?? '' };
}
```

Also update:

```ts
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
```

And add `"identity"` to `public/manifest.json` permissions.

- [ ] **Step 5: Run the auth-helper test to verify it passes**

Run: `node --test src/lib/google-auth.test.mjs`
Expected: PASS with 3 passing tests and 0 failures

- [ ] **Step 6: Commit**

```bash
git add public/manifest.json src/lib/supabase.ts src/lib/google-auth.ts src/lib/google-auth.test.mjs
git commit -m "feat: add extension google auth flow"
```

### Task 2: Popup Login Surface And Sticky Shell

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/workspace/WorkspaceActionDialog.tsx`
- Create: `tests/canopy-shell-login.test.mjs`
- Modify: `tests/eden-bright-redesign.test.mjs`
- Modify: `src/popup/LoginForm.tsx`
- Modify: `src/popup/components/PopupShell.tsx`
- Modify: `src/popup/Dashboard.tsx`
- Modify: `src/popup/App.tsx`

- [ ] **Step 1: Write the failing popup regression test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('popup login and shell match the approved batch-1 structure', () => {
  const loginForm = read('src/popup/LoginForm.tsx');
  const popupShell = read('src/popup/components/PopupShell.tsx');
  const popupDashboard = read('src/popup/Dashboard.tsx');
  const popupApp = read('src/popup/App.tsx');
  const manifest = JSON.parse(read('public/manifest.json'));

  assert.ok(loginForm.includes('signInWithGoogleInExtension'));
  assert.ok(!loginForm.includes('Sign in to sync across devices'));
  assert.ok(loginForm.includes('Continue with Google'));
  assert.ok(loginForm.includes('Continue with Email'));
  assert.ok(loginForm.includes('Use Local Only'));
  assert.ok(popupShell.includes('sticky top-0'));
  assert.ok(popupShell.includes('overflow-hidden'));
  assert.ok(popupShell.includes('text-center'));
  assert.ok(popupShell.includes('font-semibold'));
  assert.ok(!popupDashboard.includes('window.prompt'));
  assert.ok(!popupDashboard.includes('window.confirm'));
  assert.ok(popupDashboard.includes('WorkspaceActionDialog'));
  assert.ok(popupDashboard.includes('handleOpenSidePanel'));
  assert.ok(popupDashboard.includes('PanelsTopLeft'));
  assert.ok(manifest.permissions.includes('identity'));
  assert.ok(popupApp.includes('h-[500px]'));
  assert.ok(popupApp.includes('authError'));
});
```

In `tests/eden-bright-redesign.test.mjs`, rewrite the existing popup and sidepanel assertions that currently pin the old shell behavior. At minimum:

- remove the expectation that sidepanel root views include `This Page`
- remove the expectation that sidepanel code still references `openPopup`
- update popup auth expectations to the new helper-driven login flow and sticky shell contract

- [ ] **Step 2: Run the popup regression test to verify it fails**

Run: `node --test tests/eden-bright-redesign.test.mjs tests/canopy-shell-login.test.mjs`
Expected: FAIL because the popup files do not yet reference `signInWithGoogleInExtension`, `WorkspaceActionDialog`, sticky popup shell structure, or the fixed-height shell contract, and the existing redesign suite still asserts the old shell behavior

- [ ] **Step 3: Implement the popup login wiring and shell polish**

Update `src/popup/LoginForm.tsx` to call the helper instead of direct popup OAuth:

```ts
const handleGoogleSignIn = async () => {
  setIsLoading(true);
  setError('');

  try {
    const result = await signInWithGoogleInExtension({
      getRedirectURL: () => chrome.identity.getRedirectURL(),
      signInWithOAuth: (credentials) => supabase.auth.signInWithOAuth(credentials),
      launchWebAuthFlow: (details) => chrome.identity.launchWebAuthFlow(details),
      exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
    });

    onLogin(result.email);
  } catch (caughtError) {
    setError(caughtError instanceof Error ? caughtError.message : 'Google sign-in failed');
  } finally {
    setIsLoading(false);
  }
};
```

Apply the approved copy/layout changes:

- headline stays centered
- bump to the next size step and stronger weight
- keep only the neutral descriptive sentence, not the sync sentence
- keep email and local-only visible on the first screen

Create the reusable in-app dialog layer:

- `src/components/ui/dialog.tsx`: thin Radix wrapper matching the existing `Button` / `Input` ecosystem
- `src/components/workspace/WorkspaceActionDialog.tsx`: Canopy-styled modal that supports:
  - title and body copy
  - destructive and non-destructive confirmation
  - optional single input field for prompt-style actions
  - inline validation/error text instead of `window.alert`

Use it in `src/popup/Dashboard.tsx` to replace:

- `window.prompt` for `New Folder`
- `window.confirm` for `Clear All Notes`

Drive those flows through local dialog state such as:

```ts
type PopupDialogState =
  | { type: 'new-folder'; value: string; error: string | null }
  | { type: 'clear-all' }
  | null;
```

Update `src/popup/components/PopupShell.tsx` so the popup shell behaves like a fixed shell instead of a growing page:

```tsx
<div className="flex h-full min-h-[500px] flex-col overflow-hidden bg-[#fcfbf7] text-[#173628]">
  <div className="sticky top-0 z-20 border-b border-[#ece7de] bg-[#fcfbf7]/95 px-5 pb-4 pt-5 backdrop-blur">
    ...
  </div>
  <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
</div>
```

Inside the same popup header work, explicitly update the Canopy copy block so the tagline treatment is stronger and centered rather than remaining the current left-aligned secondary line. The implementer should not treat the existing header text styling as acceptable once the sticky shell is in place.

Update `src/popup/Dashboard.tsx` so the header utilities render both:

- sidepanel launch icon
- settings icon

Prefer a single fragment passed into the shell rather than a labeled CTA.

Update `src/popup/App.tsx` so the outer popup frame is fixed-height and overflow-hidden:

```tsx
<div className="h-[500px] w-[380px] overflow-hidden bg-[#fcfbf7] text-[#173628]">
```

In the same file, add explicit popup auth-hydration error handling:

- introduce an `authError: string | null` state
- wrap the initial `chrome.storage.local.get()` and `supabase.auth.getSession()` bootstrap in `try/catch/finally`
- guarantee that loading state clears on both success and failure
- render an inline error state in the popup entry experience when hydration fails instead of staying on the spinner or failing silently

Minimal shape:

```ts
const [authError, setAuthError] = useState<string | null>(null);

useEffect(() => {
  async function bootstrapAuth() {
    try {
      setAuthError(null);
      // existing storage + session lookup
    } catch (caughtError) {
      setAuthError(
        caughtError instanceof Error ? caughtError.message : 'Failed to determine auth state'
      );
      setAuthMode('login');
      setUserEmail('');
    }
  }

  void bootstrapAuth();
}, []);
```

The rendered login/loading branch should surface `authError` inline with the same calm shell treatment used elsewhere in the popup rather than relying on browser dialogs.

Update `tests/eden-bright-redesign.test.mjs` in the same task so the repo’s existing redesign suite matches the new popup shell/login contract instead of the pre-batch behavior.

- [ ] **Step 4: Run the popup regression tests to verify they pass**

Run: `node --test src/lib/google-auth.test.mjs tests/eden-bright-redesign.test.mjs tests/canopy-shell-login.test.mjs`
Expected: PASS with all tests green

- [ ] **Step 5: Run the pages build to verify popup changes bundle cleanly**

Run: `npm run build:pages`
Expected: PASS with generated popup and sidepanel bundles under `dist/`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/workspace/WorkspaceActionDialog.tsx tests/eden-bright-redesign.test.mjs tests/canopy-shell-login.test.mjs src/popup/LoginForm.tsx src/popup/components/PopupShell.tsx src/popup/Dashboard.tsx src/popup/App.tsx
git commit -m "feat: polish popup login shell"
```

### Task 3: Sidepanel Root Views And Width Guard

**Files:**
- Modify: `src/lib/use-extension-workspace.ts`
- Modify: `src/sidepanel/App.tsx`
- Modify: `src/sidepanel/components/SegmentedControl.tsx`
- Modify: `src/sidepanel/components/SidePanelShell.tsx`
- Modify: `src/sidepanel/components/FoldersView.tsx`
- Modify: `src/sidepanel/components/TagManager.tsx`
- Modify: `src/components/workspace/WorkspaceActionDialog.tsx`
- Modify: `tests/eden-bright-redesign.test.mjs`
- Modify: `tests/canopy-shell-login.test.mjs`

- [ ] **Step 1: Extend the regression test with the failing sidepanel expectations**

```js
test('sidepanel shell removes This Page and keeps a centered work surface', () => {
  const sidepanelApp = read('src/sidepanel/App.tsx');
  const segmentedControl = read('src/sidepanel/components/SegmentedControl.tsx');
  const shell = read('src/sidepanel/components/SidePanelShell.tsx');
  const foldersView = read('src/sidepanel/components/FoldersView.tsx');
  const tagManager = read('src/sidepanel/components/TagManager.tsx');
  const workspaceHook = read('src/lib/use-extension-workspace.ts');

  assert.ok(!segmentedControl.includes('This Page'));
  assert.ok(!sidepanelApp.includes('PanelsTopLeft'));
  assert.ok(!sidepanelApp.includes('handleOpenPopup'));
  assert.ok(!sidepanelApp.includes('window.confirm'));
  assert.ok(!foldersView.includes('window.prompt'));
  assert.ok(!foldersView.includes('window.alert'));
  assert.ok(!foldersView.includes('window.confirm'));
  assert.ok(!tagManager.includes('window.confirm'));
  assert.ok(foldersView.includes('WorkspaceActionDialog'));
  assert.ok(tagManager.includes('WorkspaceActionDialog'));
  assert.ok(shell.includes('max-w-[720px]'));
  assert.ok(workspaceHook.includes('allowedViewsByShell'));
});
```

In `tests/eden-bright-redesign.test.mjs`, replace the old sidepanel assertions with the new intended ones:

- sidepanel root view type no longer includes `this-page`
- sidepanel no longer references `openPopup`
- segmented control no longer includes `This Page`
- sidepanel shell/body reflects the fixed-width work surface

- [ ] **Step 2: Run the sidepanel regression test to verify it fails**

Run: `node --test tests/eden-bright-redesign.test.mjs tests/canopy-shell-login.test.mjs`
Expected: FAIL because the sidepanel still exposes `This Page`, still has popup-opening code, still uses browser dialogs, and does not constrain the body width

- [ ] **Step 3: Implement the sidepanel view-boundary and layout changes**

In `src/lib/use-extension-workspace.ts`, add shell-aware sanitization:

```ts
const allowedViewsByShell: Record<ShellType, WorkspaceView[]> = {
  popup: ['this-page', 'all-notes', 'folders', 'tags', 'settings'],
  sidepanel: ['all-notes', 'folders', 'tags', 'settings'],
};

const defaultView = options.shell === 'popup' ? 'this-page' : 'all-notes';

function normalizeView(nextView: WorkspaceView): WorkspaceView {
  return allowedViewsByShell[options.shell].includes(nextView) ? nextView : defaultView;
}

const [activeView, setActiveView] = useState<WorkspaceView>(defaultView);
const setView = useCallback((nextView: WorkspaceView) => {
  setActiveView(normalizeView(nextView));
}, [options.shell]);
```

In `src/sidepanel/components/SegmentedControl.tsx`, reduce `ViewMode` and `items` to:

```ts
export type ViewMode = 'all-notes' | 'folders' | 'tags';

const items = [
  { value: 'all-notes', label: 'All Notes' },
  { value: 'folders', label: 'Folders' },
  { value: 'tags', label: 'Tags' },
];
```

In `src/sidepanel/App.tsx`:

- remove `ThisPageView` import and render branch
- remove `PanelsTopLeft` import
- remove `handleOpenPopup`
- narrow `MainSidePanelView`
- remove `this-page` search placeholder
- keep `Add note` as the first header action
- keep settings as the remaining utility action
- update the unauthenticated empty state copy so it tells the user to sign in via the extension popup without rendering an in-app “Open Popup” button
- replace the settings `Clear All Notes` browser confirm with `WorkspaceActionDialog`

In `src/sidepanel/components/SidePanelShell.tsx`, keep the sticky header full-width but center the working body:

```tsx
<div className="flex-1 overflow-y-auto">
  <div className="mx-auto w-full max-w-[720px] px-5 py-4">{children}</div>
</div>
```

If the inline error banner visually belongs with the work surface, wrap it in the same `max-w-[720px]` container.

In `src/sidepanel/components/FoldersView.tsx`, remove every `window.prompt`, `window.alert`, and `window.confirm` path:

- use `WorkspaceActionDialog` for:
  - new folder
  - new subfolder
  - rename folder
  - delete folder
  - bulk move to folder
  - bulk add tag
  - bulk delete notes
- replace “folder not found” and “tag not found” alerts with inline error text rendered inside the view, near the bulk-action controls
- keep the existing folder/tree behaviors intact; this task replaces browser dialogs, not the broader folder redesign

In `src/sidepanel/components/TagManager.tsx`, replace delete and merge confirms with `WorkspaceActionDialog` while keeping the current tag operations intact.

Update `tests/eden-bright-redesign.test.mjs` in the same task so its shell assertions track the new sidepanel contract instead of the pre-batch UI.

- [ ] **Step 4: Run the sidepanel regression and shell tests to verify they pass**

Run: `node --test src/lib/google-auth.test.mjs tests/eden-bright-redesign.test.mjs tests/canopy-shell-login.test.mjs src/background/service-worker.test.js`
Expected: PASS with all tests green

- [ ] **Step 5: Run the full extension build**

Run: `npm run build`
Expected: PASS with popup, sidepanel, content, and service worker artifacts updated under `dist/`

- [ ] **Step 6: Commit**

```bash
git add src/lib/use-extension-workspace.ts src/sidepanel/App.tsx src/sidepanel/components/SegmentedControl.tsx src/sidepanel/components/SidePanelShell.tsx src/sidepanel/components/FoldersView.tsx src/sidepanel/components/TagManager.tsx src/components/workspace/WorkspaceActionDialog.tsx tests/eden-bright-redesign.test.mjs tests/canopy-shell-login.test.mjs
git commit -m "feat: streamline sidepanel shell"
```

### Task 4: External Auth Config And Final Verification

**Files:**
- Modify: `public/manifest.json`
- Test: `src/lib/google-auth.test.mjs`
- Test: `tests/eden-bright-redesign.test.mjs`
- Test: `tests/canopy-shell-login.test.mjs`
- Test: `src/background/service-worker.test.js`

- [ ] **Step 1: Confirm the extension redirect URL that Supabase must allow**

Use the extension popup devtools console after loading the unpacked extension:

```js
chrome.identity.getRedirectURL()
```

Expected: a URL shaped like `https://<extension-id>.chromiumapp.org/`

- [ ] **Step 2: Update Supabase auth configuration**

In the Supabase dashboard for Canopy:

- add the exact redirect URL from Step 1 to the auth redirect allowlist if missing
- confirm Google auth is still enabled for the project

Expected: Supabase accepts the extension callback URL without a redirect-mismatch error

- [ ] **Step 3: Run the final automated verification set**

Run: `node --test src/lib/google-auth.test.mjs tests/eden-bright-redesign.test.mjs tests/canopy-shell-login.test.mjs src/background/service-worker.test.js`
Expected: PASS with 0 failures

- [ ] **Step 4: Run the final build**

Run: `npm run build`
Expected: PASS with `dist/src/popup/index.html`, `dist/src/sidepanel/index.html`, `dist/content/content.js`, and `dist/background/service-worker.js` produced

- [ ] **Step 5: Manually verify the extension in Chrome**

1. Load `dist/` as an unpacked extension.
2. Open the popup while logged out.
3. Confirm the login screen shows the larger centered headline and no `Sign in to sync across devices` copy.
4. Click `Continue with Google` and complete the flow.
5. Confirm the popup lands in `This Page` without needing a manual refresh.
6. Confirm the popup header stays fixed while the body scrolls.
7. Confirm the popup header shows both sidepanel-launch and settings icons.
8. Open the sidepanel.
9. Confirm the root nav only shows `All Notes`, `Folders`, and `Tags`.
10. Confirm there is no `Open Popup` control in the sidepanel UI.
11. Widen the sidepanel and confirm the main content stays centered and capped near `720px`.

- [ ] **Step 6: Commit**

```bash
git add public/manifest.json src/lib/supabase.ts src/lib/google-auth.ts src/lib/google-auth.test.mjs src/components/ui/dialog.tsx src/components/workspace/WorkspaceActionDialog.tsx src/popup/LoginForm.tsx src/popup/components/PopupShell.tsx src/popup/Dashboard.tsx src/popup/App.tsx src/lib/use-extension-workspace.ts src/sidepanel/App.tsx src/sidepanel/components/SegmentedControl.tsx src/sidepanel/components/SidePanelShell.tsx src/sidepanel/components/FoldersView.tsx src/sidepanel/components/TagManager.tsx tests/eden-bright-redesign.test.mjs tests/canopy-shell-login.test.mjs
git commit -m "feat: finalize canopy shell and login updates"
```
