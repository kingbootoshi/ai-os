import { Command } from '../../../terminal/types/commands';
import { deleteNote } from '../../../supabase/functions/notes/noteQueries';

export const deleteNoteCommand: Command = {
  name: 'delete-note',
  description: 'Delete a note by ID. Usage: notes delete-note <note-id>',
  parameters: [
    {
      name: 'noteId',
      description: 'ID of the note to delete',
      required: true,
      type: 'number'
    }
  ],
  handler: async (args) => {
    try {
      const success = await deleteNote(args.noteId);
      if (success) {
        return {
          output: `✅ Note #${args.noteId} deleted successfully.`
        };
      }
      return {
        output: '❌ Failed to delete note.'
      };
    } catch (error) {
      return {
        output: `❌ Error deleting note: ${error}`
      };
    }
  }
};