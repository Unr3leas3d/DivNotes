import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { Session } from "@supabase/supabase-js";
import type CanopyPlugin from "./main";

export class CanopySettingTab extends PluginSettingTab {
  plugin: CanopyPlugin;

  constructor(app: App, plugin: CanopyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Canopy Sync" });
    containerEl.createEl("h3", { text: "Account" });

    if (this.plugin.settings.email) {
      new Setting(containerEl)
        .setName("Signed in as")
        .setDesc(this.plugin.settings.email)
        .addButton((button) =>
          button.setButtonText("Sign out").onClick(async () => {
            await this.plugin.auth.signOut();
            await this.plugin.stopSync();
            this.display();
          })
        );
    } else {
      new Setting(containerEl)
        .setName("Sign in with Google")
        .setDesc("Opens your browser to complete sign-in")
        .addButton((button) =>
          button.setButtonText("Google").setCta().onClick(async () => {
            await this.plugin.auth.signInWithGoogle();
          })
        );

      let emailValue = "";
      let passwordValue = "";

      new Setting(containerEl)
        .setName("Sign in with email")
        .addText((text) =>
          text.setPlaceholder("Email").onChange((value) => {
            emailValue = value;
          })
        )
        .addText((text) => {
          text.setPlaceholder("Password").onChange((value) => {
            passwordValue = value;
          });
          text.inputEl.type = "password";
        })
        .addButton((button) =>
          button.setButtonText("Sign in").setCta().onClick(async () => {
            if (!emailValue || !passwordValue) {
              new Notice("Please enter email and password");
              return;
            }

            const session = (await this.plugin.auth.signInWithEmail(
              emailValue,
              passwordValue
            )) as Session | null;

            if (!session) {
              return;
            }

            await this.plugin.startSync(session);
            this.display();
          })
        );
    }

    containerEl.createEl("h3", { text: "Sync" });
    new Setting(containerEl)
      .setName("Vault folder")
      .setDesc("Root folder in your vault where Canopy notes are stored")
      .addText((text) =>
        text
          .setPlaceholder("Canopy")
          .setValue(this.plugin.settings.vaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.vaultFolder = value || "Canopy";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Folder mode")
      .setDesc("How Canopy folders map to your vault")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("mirrored", "Mirrored (subdirectories)")
          .addOption("flat", "Flat (frontmatter metadata)")
          .setValue(this.plugin.settings.folderMode)
          .onChange(async (value) => {
            this.plugin.settings.folderMode = value as "mirrored" | "flat";
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Status" });

    const statusMap: Record<CanopyPlugin["settings"]["syncStatus"], string> = {
      disconnected: "Disconnected",
      connected: "Connected",
      syncing: "Syncing...",
      offline: "Offline - will retry",
      auth_expired: "Auth expired - re-authenticate"
    };

    new Setting(containerEl)
      .setName("Sync status")
      .setDesc(statusMap[this.plugin.settings.syncStatus] ?? "Unknown");

    if (this.plugin.settings.lastSyncedAt) {
      new Setting(containerEl)
        .setName("Last synced")
        .setDesc(new Date(this.plugin.settings.lastSyncedAt).toLocaleString());
    }
  }
}
