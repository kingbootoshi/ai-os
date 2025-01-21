CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Create the notes table with user_id column
CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(384),              -- Vector column for semantic search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id), -- Foreign key to auth.users
  is_public BOOLEAN DEFAULT false     -- Flag to control note visibility
);

-- Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Policy for inserting notes (users can only insert their own notes)
CREATE POLICY "users_can_insert_own_notes" ON notes
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy for viewing notes (users can view their own notes and public notes)
CREATE POLICY "users_can_view_own_and_public_notes" ON notes
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR is_public = true
  );

-- Policy for updating notes (users can only update their own notes)
CREATE POLICY "users_can_update_own_notes" ON notes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy for deleting notes (users can only delete their own notes)
CREATE POLICY "users_can_delete_own_notes" ON notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create approximate nearest neighbor index for fast vector search
CREATE INDEX IF NOT EXISTS notes_embedding_hnsw_idx
  ON notes
  USING hnsw (embedding vector_ip_ops);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);

-- Create function to query by embeddings (respecting RLS)
CREATE OR REPLACE FUNCTION query_notes_embeddings(embedding VECTOR(384), match_threshold FLOAT)
RETURNS SETOF notes
LANGUAGE plpgsql
SECURITY DEFINER -- Function runs with definer's permissions but RLS is still enforced
AS $$
BEGIN
  RETURN QUERY
    SELECT *
    FROM notes
    WHERE notes.embedding <#> embedding < -match_threshold
    ORDER BY notes.embedding <#> embedding
    LIMIT 5;
END;
$$;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();