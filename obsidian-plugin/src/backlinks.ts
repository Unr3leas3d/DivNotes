import { TFile, TFolder, Vault, normalizePath } from "obsidian";
import type { SupabaseNoteRow } from "./types";
import { buildNoteLinkName } from "./file-mapper";

export class BacklinkManager {
  private vault: Vault;
  private vaultFolder: string;

  constructor(vault: Vault, vaultFolder: string) {
    this.vault = vault;
    this.vaultFolder = vaultFolder;
  }

  async rebuild(notes: SupabaseNoteRow[]): Promise<void> {
    await this.rebuildDomainIndexes(notes);
    await this.updateCrossLinks(notes);
  }

  private async rebuildDomainIndexes(notes: SupabaseNoteRow[]): Promise<void> {
    const sitesFolder = normalizePath(`${this.vaultFolder}/Sites`);
    await this.ensureFolder(sitesFolder);

    const notesByDomain = new Map<string, SupabaseNoteRow[]>();
    for (const note of notes) {
      const domain = note.page_domain;
      if (!notesByDomain.has(domain)) {
        notesByDomain.set(domain, []);
      }
      notesByDomain.get(domain)?.push(note);
    }

    const existingFiles = new Set<string>();
    const sitesDir = this.vault.getAbstractFileByPath(sitesFolder);
    if (sitesDir instanceof TFolder) {
      for (const child of sitesDir.children) {
        if (child instanceof TFile && child.extension === "md") {
          existingFiles.add(child.path);
        }
      }
    }

    for (const [domain, domainNotes] of notesByDomain.entries()) {
      const filePath = normalizePath(`${sitesFolder}/${sanitizeFileName(domain)}.md`);
      await this.writeFile(filePath, this.buildDomainIndex(domain, domainNotes));
      existingFiles.delete(filePath);
    }

    for (const stalePath of existingFiles) {
      const file = this.vault.getAbstractFileByPath(stalePath);
      if (file instanceof TFile) {
        await this.vault.delete(file);
      }
    }
  }

  private buildDomainIndex(domain: string, notes: SupabaseNoteRow[]): string {
    const lines = [
      "---",
      'canopy_type: "domain_index"',
      `domain: "${domain}"`,
      "---",
      "",
      `# ${domain}`,
      ""
    ];

    for (const note of notes) {
      lines.push(`- [[${buildNoteLinkName(note.page_title, note.id)}]]`);
    }

    return lines.join("\n");
  }

  async updateCrossLinks(notes: SupabaseNoteRow[]): Promise<void> {
    const byUrl = new Map<string, SupabaseNoteRow[]>();
    for (const note of notes) {
      if (!byUrl.has(note.page_url)) {
        byUrl.set(note.page_url, []);
      }
      byUrl.get(note.page_url)?.push(note);
    }

    for (const note of notes) {
      const siblings = (byUrl.get(note.page_url) ?? []).filter((item) => item.id !== note.id);
      await this.updateRelatedSection(note, this.buildRelatedSection(note, siblings));
    }
  }

  private buildRelatedSection(note: SupabaseNoteRow, siblings: SupabaseNoteRow[]): string {
    const lines = ["", "## Related", `- [[${sanitizeFileName(note.page_domain)}|${note.page_domain}]]`];
    for (const sibling of siblings) {
      lines.push(`- [[${buildNoteLinkName(sibling.page_title, sibling.id)}]]`);
    }
    return lines.join("\n");
  }

  private async updateRelatedSection(note: SupabaseNoteRow, relatedSection: string): Promise<void> {
    const fileName = `${buildNoteLinkName(note.page_title, note.id)}.md`;
    const file = this.vault
      .getMarkdownFiles()
      .find((candidate) => candidate.path.startsWith(`${this.vaultFolder}/`) && candidate.name === fileName);

    if (!file) {
      return;
    }

    const content = await this.vault.read(file);
    const withoutRelated = content.replace(/\n## Related\n[\s\S]*$/, "");
    await this.vault.modify(file, `${withoutRelated.trimEnd()}\n${relatedSection}\n`);
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = normalizePath(path).split("/");
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.vault.createFolder(current);
      }
    }
  }

  private async writeFile(path: string, content: string): Promise<void> {
    const existing = this.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.vault.modify(existing, content);
      return;
    }

    await this.vault.create(path, content);
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}
