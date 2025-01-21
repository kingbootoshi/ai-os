import { supabase } from '../../supabaseClient';
import { logger } from '../../../utils/logger';
/**
 * Mock function to generate a vector embedding for a given text.
 * In production, you would likely call a local or hosted model,
 * or use an Edge Function to compute the embedding with 'gte-small'.
 */
async function embedText(content: string): Promise<number[]> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-embedding', {
      body: { text: content }
    });
    
    if (error) throw error;
    return data.embedding;
  } catch (err) {
    logger.error('Error generating embedding:', err);
    // Fallback to random embedding for development
    const length = 384;
    return Array.from({ length }, () => Math.random());
  }
}

/**
 * Create a new note
 */
export async function createNote(content: string): Promise<number | null> {
  try {
    const embedding = await embedText(content);

    const { data, error } = await supabase
      .from('notes')
      .insert({
        content,
        embedding,  // store as vector
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error creating note:', error);
      return null;
    }
    logger.info('Created note with ID:', data.id);
    return data.id;
  } catch (err) {
    logger.error('Exception in createNote:', err);
    return null;
  }
}

/**
 * Edit an existing note
 */
export async function editNote(noteId: number, newContent: string): Promise<boolean> {
  try {
    const embedding = await embedText(newContent);

    const { error } = await supabase
      .from('notes')
      .update({
        content: newContent,
        embedding,
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId);

    if (error) {
      logger.error('Error editing note:', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('Exception in editNote:', err);
    return false;
  }
}

/**
 * Delete a note by ID
 */
export async function deleteNote(noteId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      logger.error('Error deleting note:', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('Exception in deleteNote:', err);
    return false;
  }
}

/**
 * List all notes
 */
export async function listNotes(): Promise<{ id: number; content: string }[]> {
  try {
    // For demonstration, limit to 50
    const { data, error } = await supabase
      .from('notes')
      .select('id, content')
      .order('id', { ascending: true })
      .limit(50);

    if (error || !data) {
      logger.error('Error listing notes:', error);
      return [];
    }
    return data;
  } catch (err) {
    logger.error('Exception in listNotes:', err);
    return [];
  }
}

/**
 * Semantic search for notes
 */
export async function searchNotes(query: string): Promise<{ id: number; content: string }[]> {
  try {
    const embedding = await embedText(query);

    const { data, error } = await supabase
      .rpc('query_notes_embeddings', {
        embedding: embedding,
        match_threshold: 0.8
      })
      .select('id, content');

    if (error) {
      logger.error('Error searching notes:', error);
      throw error;
    }

    if (!data) return [];

    return data.map(row => ({
      id: row.id,
      content: row.content
    }));

  } catch (err) {
    logger.error('Exception in searchNotes:', err);
    return [];
  }
}

export type Database = {
  public: {
    Tables: {
      notes: {
        Row: {
          id: number
          content: string
          embedding: number[]
          created_at: string
          updated_at: string
          user_id: string
          is_public: boolean
        }
        Insert: {
          content: string
          embedding?: number[]
          user_id: string
          is_public?: boolean
        }
        Update: {
          content?: string
          embedding?: number[]
          is_public?: boolean
        }
      }
    }
    Functions: {
      query_notes_embeddings: {
        Args: {
          embedding: number[]
          match_threshold: number
        }
        Returns: Array<{
          id: number
          content: string
          embedding: number[]
          created_at: string
          updated_at: string
          user_id: string
          is_public: boolean
        }>
      }
    }
  }
}