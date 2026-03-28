-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES auth.users NOT NULL,
  name        text NOT NULL,
  parent_id   uuid REFERENCES folders(id) ON DELETE CASCADE,
  color       text,
  pinned      boolean DEFAULT false,
  "order"     integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES auth.users NOT NULL,
  name        text NOT NULL,
  color       text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Create note_tags junction table
CREATE TABLE IF NOT EXISTS note_tags (
  note_id     uuid REFERENCES notes(id) ON DELETE CASCADE,
  tag_id      uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- Add new columns to notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;

-- RLS policies for folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY folders_user_policy ON folders FOR ALL USING (user_id = auth.uid());

-- RLS policies for tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_user_policy ON tags FOR ALL USING (user_id = auth.uid());

-- RLS for note_tags (user must own the note)
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_tags_user_policy ON note_tags FOR ALL
  USING (note_id IN (SELECT id FROM notes WHERE user_id = auth.uid()))
  WITH CHECK (note_id IN (SELECT id FROM notes WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
