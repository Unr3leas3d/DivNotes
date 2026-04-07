import type { NoteFrontmatter, SupabaseFolderRow, SupabaseNoteRow } from "./types";

export function noteToMarkdown(
  row: SupabaseNoteRow,
  folderMode: "mirrored" | "flat" = "mirrored",
  folders: SupabaseFolderRow[] = []
): string {
  const frontmatter: NoteFrontmatter = {
    canopy_id: row.id,
    url: row.page_url,
    hostname: row.page_domain,
    page_title: row.page_title || "",
    element_selector: row.element_selector,
    element_tag: row.element_tag,
    selected_text: row.selected_text ?? null,
    color: row.color || "#7c3aed",
    tags: (row.note_tags ?? []).map((entry) => entry.tag_id),
    pinned: row.pinned ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    folder:
      folderMode === "flat"
        ? row.folder_id
          ? resolveFolderPath(row.folder_id, folders)
          : "Unfiled"
        : undefined
  };

  const yamlLines = [
    "---",
    `canopy_id: "${escapeFrontmatterString(frontmatter.canopy_id)}"`,
    `url: "${escapeFrontmatterString(frontmatter.url)}"`,
    `hostname: "${escapeFrontmatterString(frontmatter.hostname)}"`,
    `page_title: "${escapeFrontmatterString(frontmatter.page_title)}"`,
    `element_selector: "${escapeFrontmatterString(frontmatter.element_selector)}"`,
    `element_tag: "${escapeFrontmatterString(frontmatter.element_tag)}"`,
    frontmatter.selected_text === null
      ? "selected_text: null"
      : `selected_text: "${escapeFrontmatterString(frontmatter.selected_text)}"`,
    `color: "${escapeFrontmatterString(frontmatter.color)}"`,
    "tags:",
    ...frontmatter.tags.map((tag) => `  - "${escapeFrontmatterString(tag)}"`),
    `pinned: ${frontmatter.pinned}`,
    `created_at: "${escapeFrontmatterString(frontmatter.created_at)}"`,
    `updated_at: "${escapeFrontmatterString(frontmatter.updated_at)}"`
  ];

  if (folderMode === "flat" && frontmatter.folder) {
    yamlLines.push(`folder: "${escapeFrontmatterString(frontmatter.folder)}"`);
  }

  yamlLines.push("---");

  return `${yamlLines.join("\n")}\n\n${row.content || ""}`;
}

export function parseMarkdownNote(fileContent: string): {
  frontmatter: NoteFrontmatter | null;
  content: string;
} {
  const match = fileContent.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return {
      frontmatter: null,
      content: fileContent
    };
  }

  const frontmatter = parseYamlFrontmatter(match[1]);
  const content = fileContent.slice(match[0].length).replace(/^\n/, "");

  return {
    frontmatter,
    content
  };
}

export function noteFilePath(
  row: SupabaseNoteRow,
  vaultFolder: string,
  folderMode: "mirrored" | "flat",
  folders: SupabaseFolderRow[]
): string {
  const fileName = `${buildNoteLinkName(row.page_title, row.id)}.md`;

  if (folderMode === "flat") {
    return `${vaultFolder}/${fileName}`;
  }

  const folderPath = row.folder_id ? resolveFolderPath(row.folder_id, folders) : "Unfiled";
  return `${vaultFolder}/${folderPath}/${fileName}`;
}

export function resolveFolderPath(folderId: string, folders: SupabaseFolderRow[]): string {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const parts: string[] = [];
  let current = folderMap.get(folderId);

  while (current) {
    parts.unshift(sanitizeFileName(current.name));
    current = current.parent_id ? folderMap.get(current.parent_id) : undefined;
  }

  return parts.length > 0 ? parts.join("/") : "Unfiled";
}

export function buildNoteLinkName(pageTitle: string, noteId: string): string {
  const title = sanitizeFileName(pageTitle || "Untitled");
  return `${title} - ${noteId.slice(0, 6)}`;
}

export function stripManagedRelatedSection(content: string): string {
  return content.replace(/\n## Related\n[\s\S]*$/, "").trimEnd();
}

function parseYamlFrontmatter(yaml: string): NoteFrontmatter {
  const result: Record<string, unknown> = {};
  const tags: string[] = [];
  let currentKey = "";

  for (const line of yaml.split("\n")) {
    const listMatch = line.match(/^\s+-\s+"?([^"]*)"?$/);
    if (listMatch && currentKey === "tags") {
      tags.push(unescapeFrontmatterString(listMatch[1]));
      continue;
    }

    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!kvMatch) {
      continue;
    }

    currentKey = kvMatch[1];
    const rawValue = kvMatch[2];

    if (rawValue === "null") {
      result[currentKey] = null;
      continue;
    }

    if (rawValue === "true") {
      result[currentKey] = true;
      continue;
    }

    if (rawValue === "false") {
      result[currentKey] = false;
      continue;
    }

    result[currentKey] = unquote(rawValue);
  }

  result.tags = tags;
  return result as unknown as NoteFrontmatter;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "Untitled";
}

function escapeFrontmatterString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function unescapeFrontmatterString(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return unescapeFrontmatterString(value.slice(1, -1));
  }

  return unescapeFrontmatterString(value);
}
