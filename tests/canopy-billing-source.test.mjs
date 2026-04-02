import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('billing migrations create profile, billing-event, and entitlement-RLS foundations', () => {
  const migration003 = 'supabase/migrations/003_profiles_billing.sql';
  const migration004 = 'supabase/migrations/004_entitlement_rls_and_note_updated_at.sql';

  assert.equal(existsSync(path.join(repoRoot, migration003)), true);
  assert.equal(existsSync(path.join(repoRoot, migration004)), true);

  const profilesSql = read(migration003).toLowerCase();
  const rlsSql = read(migration004).toLowerCase();

  assert.match(profilesSql, /create table if not exists profiles/);
  assert.match(profilesSql, /create table if not exists billing_events/);
  assert.match(profilesSql, /create function.*handle_new_user_profile/s);
  assert.match(rlsSql, /alter table notes add column if not exists updated_at/);
  assert.match(rlsSql, /create or replace function.*has_active_pro_entitlement/s);
  assert.match(rlsSql, /profiles\.plan = 'pro'/);
  assert.match(rlsSql, /profiles\.entitlement_status = 'active'/);
});

test('billing edge functions and extension billing actions exist', () => {
  const checkoutFnPath = 'supabase/functions/create-checkout-session/index.ts';
  const portalFnPath = 'supabase/functions/create-customer-portal-session/index.ts';
  const webhookFnPath = 'supabase/functions/polar-webhook/index.ts';

  assert.equal(existsSync(path.join(repoRoot, checkoutFnPath)), true);
  assert.equal(existsSync(path.join(repoRoot, portalFnPath)), true);
  assert.equal(existsSync(path.join(repoRoot, webhookFnPath)), true);

  const checkoutFn = read(checkoutFnPath);
  const portalFn = read(portalFnPath);
  const webhookFn = read(webhookFnPath);
  const actions = read('src/lib/extension-workspace-actions.ts');

  assert.match(checkoutFn, /POLAR_MONTHLY_PRICE_ID/);
  assert.match(checkoutFn, /POLAR_YEARLY_PRICE_ID/);
  assert.match(checkoutFn, /external_id|external_customer_id/);
  assert.match(portalFn, /polar_customer_id/);
  assert.match(webhookFn, /customer\.state_changed/);
  assert.match(webhookFn, /billing_events/);
  assert.match(actions, /create-checkout-session/);
  assert.match(actions, /create-customer-portal-session/);
});

test('cloud services key off entitlement state and notes carry updatedAt', () => {
  const types = read('src/lib/types.ts');
  const notesService = read('src/lib/notes-service.ts');
  const foldersService = read('src/lib/folders-service.ts');
  const tagsService = read('src/lib/tags-service.ts');

  assert.match(types, /updatedAt: string;/);
  assert.match(notesService, /updated_at/);
  assert.match(notesService, /cloudSyncEnabled/);
  assert.match(foldersService, /cloudSyncEnabled/);
  assert.match(tagsService, /cloudSyncEnabled/);
});

test('settings and landing surfaces expose free/pro messaging and billing actions', () => {
  const popupSettings = read('src/popup/components/SettingsView.tsx');
  const sidepanelSettings = read('src/sidepanel/components/SettingsView.tsx');
  const landingApp = read('landing/src/App.tsx');
  const privacyPolicy = read('landing/src/pages/PrivacyPolicy.tsx');

  assert.match(popupSettings, /Upgrade Monthly/);
  assert.match(popupSettings, /Upgrade Yearly/);
  assert.match(popupSettings, /Manage Billing/);
  assert.match(sidepanelSettings, /Free|Pro|Inactive/);
  assert.match(landingApp, /Free/);
  assert.match(landingApp, /Pro/);
  assert.match(privacyPolicy, /Polar/);
});
