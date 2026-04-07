import { Plugin } from "obsidian";
import type { Session } from "@supabase/supabase-js";
import { CanopyAuth } from "./auth";
import { CanopySettingTab } from "./settings";
import { getSupabaseClient, resetSupabaseClient } from "./supabase-client";
import { SyncEngine } from "./sync-engine";
import { DEFAULT_SETTINGS, type CanopyPluginSettings, type PluginPersistedData } from "./types";

export default class CanopyPlugin extends Plugin {
  settings!: CanopyPluginSettings;
  auth!: CanopyAuth;
  private syncEngine: SyncEngine | null = null;

  async onload() {
    await this.loadSettings();

    const supabase = getSupabaseClient(this);
    this.auth = new CanopyAuth(this, supabase);
    this.addSettingTab(new CanopySettingTab(this.app, this));

    this.registerObsidianProtocolHandler("canopy-auth", async (params) => {
      const session = await this.auth.handleOAuthCallback(params);
      if (session) {
        await this.startSync(session);
      }
    });

    const session = await this.auth.restoreSession();
    if (session) {
      this.settings.email = session.user.email ?? null;
      await this.saveSettings();
      await this.startSync(session);
    }
  }

  async onunload() {
    await this.stopSync();
    resetSupabaseClient();
  }

  async startSync(session: Session): Promise<void> {
    await this.stopSync();
    const supabase = getSupabaseClient(this);
    this.syncEngine = new SyncEngine(this, supabase, this.auth.getUserId(session));
    await this.syncEngine.start();
  }

  async stopSync(): Promise<void> {
    if (!this.syncEngine) {
      return;
    }

    await this.syncEngine.stop();
    this.syncEngine = null;
  }

  async loadSettings() {
    const data = ((await this.loadData()) ?? {}) as PluginPersistedData;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...data
    };
  }

  async saveSettings() {
    const data = ((await this.loadData()) ?? {}) as PluginPersistedData;
    Object.assign(data, this.settings);
    await this.saveData(data);
  }
}
