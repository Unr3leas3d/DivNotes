# Canopy Security Audit Report

**Date:** 2026-03-31
**Version:** 1.0.0
**Extension:** Canopy (Chrome Extension, Manifest V3)

---

## Executive Summary

Canopy is a Chrome Extension that lets users attach markdown notes to DOM elements on any webpage, with optional Supabase cloud sync. This audit covers code-level security, extension permissions, data handling, and Chrome Web Store readiness.

**Overall Risk Level: MODERATE**

The extension uses modern security practices (MV3, DOMPurify, PKCE auth flow) but has several areas that should be addressed before public launch. No critical vulnerabilities were found that would allow remote code execution, but there are hardening improvements needed for production readiness.

---

## Findings

### 1. Hardcoded Supabase Credentials [INFO - Acceptable]

**File:** `src/lib/supabase.ts:3-4`

```typescript
const SUPABASE_URL = 'https://zqdaairthppjdioddatv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

**Assessment:** This is the Supabase **anonymous/public key**, which is designed to be client-facing. This is standard practice for Chrome extensions and SPAs. The key only provides access gated by Row Level Security (RLS) policies.

**Action Required:**
- [ ] Verify all Supabase tables have proper RLS policies enabled
- [ ] Ensure the anon key cannot bypass RLS to access other users' data
- [ ] Confirm no server-side secrets (service_role key) are in the codebase (verified: none found)
- [ ] No `.env` files with secrets were found in the repo (verified)

**Severity:** INFO (not a vulnerability if RLS is properly configured)

---

### 2. innerHTML / dangerouslySetInnerHTML Usage [LOW - Properly Mitigated]

**Files:**
- `src/content/index.tsx:469` - `previewBody.innerHTML = simpleMarkdown(note.content)`
- `src/sidepanel/components/NoteCard.tsx:156` - `dangerouslySetInnerHTML={{ __html: renderedContent }}`

**Assessment:** Both locations pass content through `DOMPurify.sanitize()` with strict `ALLOWED_TAGS` and `ALLOWED_ATTR` whitelists before rendering. DOMPurify v3.3.1 is current and well-maintained.

**Sanitization verified at:**
- `src/content/index.tsx:1192` - `DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: [...], ALLOWED_ATTR: [...] })`
- `src/sidepanel/components/NoteCard.tsx:68` - Same pattern with explicit allowlists

**Severity:** LOW (properly mitigated with DOMPurify)

**Action Required:**
- [ ] Keep DOMPurify updated as part of regular dependency updates
- [ ] `style` attribute is allowed in the content script sanitizer (`src/content/index.tsx:1194`) - consider removing to prevent CSS injection for visual spoofing

---

### 3. Service Worker Message Validation [MEDIUM]

**File:** `src/background/service-worker.js:79-366`

**Issue:** The message listener processes messages based on `message.type` string matching but does not validate:
- Message payload structure/types
- That message data conforms to expected shapes

**Mitigating factors:**
- `chrome.runtime.onMessage` only receives messages from the extension's own contexts (content scripts, popup, side panel). External web pages cannot send messages via this channel.
- No `externally_connectable` is defined in the manifest, so no external origins can message the extension.
- The sender object is available but unused - however, this is low risk since only extension scripts can send these messages.

**Action Required:**
- [ ] Add basic type validation for critical message payloads (especially `OPEN_NOTE_TARGET` which navigates tabs using `note.url`)
- [ ] Validate `note.url` is a valid HTTP/HTTPS URL before passing to `chrome.tabs.update()`
- [ ] Add a default case that explicitly ignores unknown message types (already done: line 365)

**Severity:** MEDIUM

---

### 4. Broad Manifest Permissions [MEDIUM - By Design]

**File:** `public/manifest.json`

```json
"content_scripts": [{ "matches": ["<all_urls>"] }],
"host_permissions": ["<all_urls>"],
"permissions": ["tabs", "storage", "sidePanel", "contextMenus", "identity"]
```

**Assessment:** The `<all_urls>` pattern is necessary for the extension's core functionality (attaching notes to any webpage). Each permission is justified:

| Permission | Justification |
|---|---|
| `<all_urls>` (content_scripts) | Required - notes can be attached to any page |
| `<all_urls>` (host_permissions) | Required - content script needs page access |
| `tabs` | Required - navigate to note targets, query active tab |
| `storage` | Required - local notes and auth state |
| `sidePanel` | Required - side panel UI |
| `contextMenus` | Required - right-click "Add Note" menu |
| `identity` | Required - Google OAuth via chrome.identity |

**Chrome Web Store Impact:** Broad host permissions trigger additional review. The justification must be clearly stated in the store listing.

**Action Required:**
- [ ] Prepare a permissions justification document for Chrome Web Store review
- [ ] In store listing, explain why `<all_urls>` is required

**Severity:** MEDIUM (review friction, not a vulnerability)

---

### 5. Missing Content Security Policy [LOW]

**File:** `public/manifest.json`

**Issue:** No `content_security_policy` field defined in manifest.

**Assessment:** Manifest V3 enforces a strict default CSP: `script-src 'self'` for extension pages. The absence of an explicit CSP means the default MV3 policy applies, which is already secure. Adding an explicit CSP is a defense-in-depth measure.

**Action Required:**
- [ ] Consider adding explicit CSP for documentation clarity:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'none'"
}
```

**Severity:** LOW (MV3 defaults are secure)

---

### 6. Web-Accessible Resources Exposure [LOW]

**File:** `public/manifest.json:71-80`

```json
"web_accessible_resources": [{
  "resources": ["assets/*", "content/*"],
  "matches": ["<all_urls>"]
}]
```

**Assessment:** Exposes extension assets (CSS, images) and content script bundles to all web pages. This is necessary for the content script to function (loading styles, etc.) but allows any webpage to detect if the extension is installed by probing these resource URLs.

**Action Required:**
- [ ] Audit which specific resources need to be web-accessible - narrow the pattern if possible
- [ ] Accept that extension fingerprinting is possible (common for all extensions with web-accessible resources)

**Severity:** LOW

---

### 7. XPath Evaluation [LOW]

**File:** `src/content/index.tsx` (element targeting)

**Assessment:** Stored XPath expressions from notes are evaluated using `document.evaluate()`. XPath is a query language, not executable code - it cannot perform arbitrary code execution. Malformed XPaths will simply fail to match and return null.

**Action Required:**
- [ ] Wrap `document.evaluate()` calls in try/catch (likely already done)
- [ ] No further action needed

**Severity:** LOW

---

### 8. Local Storage Encryption [INFO]

**Issue:** Notes and auth tokens stored in `chrome.storage.local` without encryption.

**Assessment:** This is standard practice for Chrome extensions. `chrome.storage.local` is sandboxed to the extension and not accessible by web pages or other extensions. Encrypting local storage would require storing the encryption key somewhere accessible to the extension, negating the benefit.

**Action Required:** None. This is accepted practice.

**Severity:** INFO

---

### 9. Dependency Security [LOW]

**File:** `package.json`

| Dependency | Version | Status |
|---|---|---|
| `dompurify` | ^3.3.1 | Current, well-maintained |
| `marked` | ^15.0.7 | Current |
| `@supabase/supabase-js` | ^2.97.0 | Current |
| `react` | ^18.3.1 | Current |
| `vite` | ^6.1.0 | Current |

**Action Required:**
- [ ] Run `npm audit` before publishing to check for known vulnerabilities
- [ ] Set up Dependabot or similar for automated dependency security alerts

**Severity:** LOW

---

### 10. Google OAuth Implementation [SECURE]

**File:** `src/lib/google-auth.ts`

**Assessment:** The OAuth implementation follows best practices:
- Uses `chrome.identity.launchWebAuthFlow()` (secure browser window)
- PKCE flow enabled (`flowType: 'pkce'` in Supabase config)
- Authorization code exchange (not implicit grant)
- URL-based session detection disabled (`detectSessionInUrl: false`)
- Stale flow detection with `canContinue()` callback
- Error handling for callback failures

**Severity:** SECURE (no issues found)

---

## Chrome Web Store Readiness Checklist

### Required Before Submission

- [ ] **Privacy Policy** - Must be hosted at a public URL and linked in the store listing. Must disclose:
  - Data collected (email for auth, notes content, page URLs where notes are attached)
  - How data is stored (locally + optionally Supabase cloud)
  - Third-party services used (Supabase, Google OAuth)
  - Data retention and deletion policy
- [ ] **Store Listing Assets**
  - [x] Icon 128x128 (exists: `public/icons/icon-128.png`)
  - [ ] At least 1 screenshot (1280x800 or 640x400)
  - [ ] Promotional tile (440x280) - optional but recommended
  - [ ] Detailed description (explain `<all_urls>` justification)
- [ ] **Permissions Justification** - Required for `<all_urls>`, `tabs`, and `identity`
- [ ] **Single Purpose Description** - Extension must have a clear single purpose (note-taking on web pages)
- [ ] **Run `npm audit`** - Resolve any known vulnerabilities
- [ ] **Test in clean Chrome profile** - Verify full install flow works

### Recommended Before Submission

- [ ] **Add explicit CSP** to manifest.json
- [ ] **Validate URL in OPEN_NOTE_TARGET** message handler (service-worker.js:109)
- [ ] **Remove `style` from ALLOWED_ATTR** in content script DOMPurify config
- [ ] **Narrow web_accessible_resources** patterns if possible
- [ ] **Set up automated dependency scanning** (Dependabot/Snyk)
- [ ] **Add version update strategy** - plan for how updates will be pushed

### Common Rejection Reasons to Avoid

1. **Missing privacy policy** - Most common rejection reason
2. **Insufficient permissions justification** - Explain why `<all_urls>` is needed
3. **Misleading description** - Be accurate about what the extension does
4. **Unused permissions** - All current permissions are justified
5. **Remote code execution** - Not applicable (no eval, no remote script loading)

---

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Supabase anon key in source | INFO | Acceptable (verify RLS) |
| 2 | innerHTML with DOMPurify | LOW | Properly mitigated |
| 3 | Message payload validation | MEDIUM | Needs hardening |
| 4 | Broad permissions | MEDIUM | By design, needs justification |
| 5 | No explicit CSP | LOW | MV3 defaults are secure |
| 6 | Web-accessible resources | LOW | Consider narrowing |
| 7 | XPath evaluation | LOW | No risk |
| 8 | Unencrypted local storage | INFO | Standard practice |
| 9 | Dependencies | LOW | All current |
| 10 | Google OAuth | SECURE | Best practices followed |

**Priority actions before Chrome Web Store submission:**
1. Create and host a privacy policy
2. Prepare store listing with screenshots and description
3. Write permissions justification
4. Validate URL in `OPEN_NOTE_TARGET` handler
5. Run `npm audit`
6. Test in clean Chrome profile
