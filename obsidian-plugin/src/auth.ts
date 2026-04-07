import { Notice } from "obsidian";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type CanopyPlugin from "./main";

export class CanopyAuth {
  private plugin: CanopyPlugin;
  private supabase: SupabaseClient;

  constructor(plugin: CanopyPlugin, supabase: SupabaseClient) {
    this.plugin = plugin;
    this.supabase = supabase;
  }

  async signInWithEmail(email: string, password: string): Promise<Session | null> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      new Notice(`Sign in failed: ${error.message}`);
      return null;
    }

    this.plugin.settings.email = data.session?.user.email ?? null;
    await this.plugin.saveSettings();
    new Notice("Signed in to Canopy");
    return data.session;
  }

  async signInWithGoogle(): Promise<void> {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
        redirectTo: "obsidian://canopy-auth"
      }
    });

    if (error) {
      new Notice(`Google sign in failed: ${error.message}`);
      return;
    }

    if (data.url) {
      window.open(data.url);
    }
  }

  async handleOAuthCallback(params: Record<string, string>): Promise<Session | null> {
    const accessToken = params.access_token;
    const refreshToken = params.refresh_token;

    if (!accessToken || !refreshToken) {
      new Notice("OAuth callback missing tokens");
      return null;
    }

    const { data, error } = await this.supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      new Notice(`OAuth session failed: ${error.message}`);
      return null;
    }

    this.plugin.settings.email = data.session?.user.email ?? null;
    await this.plugin.saveSettings();
    new Notice("Signed in to Canopy via Google");
    return data.session;
  }

  async restoreSession(): Promise<Session | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error || !data.session) {
      return null;
    }
    return data.session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      new Notice(`Sign out failed: ${error.message}`);
      return;
    }

    this.plugin.settings.email = null;
    this.plugin.settings.syncStatus = "disconnected";
    this.plugin.settings.lastSyncedAt = null;
    await this.plugin.saveSettings();
    new Notice("Signed out of Canopy");
  }

  getUserId(session: Session): string {
    return session.user.id;
  }
}
