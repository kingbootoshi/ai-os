import { Command } from '../../../terminal/types/commands';
import { createNote } from '../../../supabase/functions/notes/noteQueries';

export const createNoteCommand: Command = {
  name: 'create-note',
  description: 'Create a new note. Usage: notes create-note "<note content>"',
  parameters: [
    {
      name: 'content',
      description: 'Note content (wrap in quotes)',
      required: true,
      type: 'string'
    }
  ],
  handler: async (args) => {
    try {
      const noteId = await createNote(args.content);
      if (noteId) {
        return {
          output: `✅ Note created with ID: ${noteId}`
        };
      }
      return {
        output: '❌ Failed to create note.'
      };
    } catch (error) {
      return {
        output: `❌ Error creating note: ${error}`
      };
    }
  }
};