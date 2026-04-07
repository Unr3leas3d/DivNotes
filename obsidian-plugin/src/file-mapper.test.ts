import { describe, expect, it } from "vitest";
import {
  buildNoteLinkName,
  noteFilePath,
  noteToMarkdown,
  parseMarkdownNote,
  resolveFolderPath,
  stripManagedRelatedSection
} from "./file-mapper";
import type { SupabaseFolderRow, SupabaseNoteRow } from "./types";

const folders: SupabaseFolderRow[] = [
  {
    id: "parent",
    user_id: "user-1",
    name: "Research",
    parent_id: null,
    order: 0,
    color: null,
    pinned: false,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z"
  },
  {
    id: "child",
    user_id: "user-1",
    name: "ML/Papers",
    parent_id: "parent",
    order: 1,
    color: null,
    pinned: false,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z"
  }
];

const note: SupabaseNoteRow = {
  id: "abcdef123456",
  user_id: "user-1",
  page_url: "https://example.com/article",
  page_title: "Quoted \"Title\"",
  page_domain: "example.com",
  element_selector: "div.article > p:nth-child(3)",
  element_tag: "p",
  element_info: "ignored",
  content: "Body line 1\nBody line 2",
  color: "#7c3aed",
  tag_label: null,
  element_xpath: null,
  element_text_hash: null,
  element_position: null,
  selected_text: "selected\ntext",
  created_at: "2026-04-01T12:00:00Z",
  updated_at: "2026-04-06T15:30:00Z",
  folder_id: "child",
  pinned: true,
  note_tags: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }]
};

describe("file-mapper", () => {
  it("writes markdown frontmatter and parses it back", () => {
    const markdown = noteToMarkdown(note, "flat", folders);

    expect(markdown).toContain('canopy_id: "abcdef123456"');
    expect(markdown).toContain('folder: "Research/ML-Papers"');

    const parsed = parseMarkdownNote(markdown);

    expect(parsed.frontmatter).toEqual({
      canopy_id: "abcdef123456",
      url: "https://example.com/article",
      hostname: "example.com",
      page_title: 'Quoted "Title"',
      element_selector: "div.article > p:nth-child(3)",
      element_tag: "p",
      selected_text: "selected\ntext",
      color: "#7c3aed",
      tags: ["tag-1", "tag-2"],
      pinned: true,
      created_at: "2026-04-01T12:00:00Z",
      updated_at: "2026-04-06T15:30:00Z",
      folder: "Research/ML-Papers"
    });
    expect(parsed.content).toBe("Body line 1\nBody line 2");
  });

  it("builds mirrored and flat note paths", () => {
    expect(noteFilePath(note, "Canopy", "mirrored", folders)).toBe(
      "Canopy/Research/ML-Papers/Quoted -Title- - abcdef.md"
    );
    expect(noteFilePath(note, "Canopy", "flat", folders)).toBe(
      "Canopy/Quoted -Title- - abcdef.md"
    );
  });

  it("resolves missing folders to Unfiled", () => {
    expect(resolveFolderPath("missing", folders)).toBe("Unfiled");
  });

  it("strips the plugin-managed related section before pushing content upstream", () => {
    const withRelated = `${note.content}\n\n## Related\n- [[example.com|example.com]]\n- [[Sibling - 123456]]\n`;
    expect(stripManagedRelatedSection(withRelated)).toBe(note.content);
  });

  it("uses sanitized note link names that match the generated file name stem", () => {
    expect(buildNoteLinkName(note.page_title, note.id)).toBe('Quoted -Title- - abcdef');
  });
});
