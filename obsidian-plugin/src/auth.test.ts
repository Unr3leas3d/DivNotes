import { describe, expect, it, vi } from "vitest";
import { CanopyAuth } from "./auth";
import type { CanopyPluginSettings } from "./types";

vi.mock("obsidian", () => ({
  Notice: vi.fn()
}));

function createPlugin() {
  const settings: CanopyPluginSettings = {
    vaultFolder: "Canopy",
    folderMode: "mirrored",
    email: null,
    syncStatus: "disconnected",
    lastSyncedAt: null
  };

  return {
    settings,
    saveSettings: vi.fn().mockResolvedValue(undefined)
  };
}

describe("CanopyAuth", () => {
  it("persists the email after password sign in", async () => {
    const plugin = createPlugin();
    const supabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: "user-1",
                email: "me@example.com"
              }
            }
          },
          error: null
        })
      }
    };

    const auth = new CanopyAuth(plugin as never, supabase as never);
    const session = await auth.signInWithEmail("me@example.com", "secret");

    expect(session?.user.email).toBe("me@example.com");
    expect(plugin.settings.email).toBe("me@example.com");
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it("clears settings on sign out", async () => {
    const plugin = createPlugin();
    plugin.settings.email = "me@example.com";
    plugin.settings.syncStatus = "connected";
    plugin.settings.lastSyncedAt = "2026-04-06T00:00:00Z";

    const supabase = {
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: null })
      }
    };

    const auth = new CanopyAuth(plugin as never, supabase as never);
    await auth.signOut();

    expect(plugin.settings.email).toBeNull();
    expect(plugin.settings.syncStatus).toBe("disconnected");
    expect(plugin.settings.lastSyncedAt).toBeNull();
  });
});
