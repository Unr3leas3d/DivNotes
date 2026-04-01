-- Ensure RLS is enabled on the notes table (idempotent)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't already exist
-- Uses DO blocks to check for existing policies before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_user_select'
    ) THEN
        EXECUTE 'CREATE POLICY notes_user_select ON notes FOR SELECT USING (user_id = auth.uid())';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_user_insert'
    ) THEN
        EXECUTE 'CREATE POLICY notes_user_insert ON notes FOR INSERT WITH CHECK (user_id = auth.uid())';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_user_update'
    ) THEN
        EXECUTE 'CREATE POLICY notes_user_update ON notes FOR UPDATE USING (user_id = auth.uid())';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_user_delete'
    ) THEN
        EXECUTE 'CREATE POLICY notes_user_delete ON notes FOR DELETE USING (user_id = auth.uid())';
    END IF;
END $$;
