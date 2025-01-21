import { Command } from '../../../terminal/types/commands';
import { editNote } from '../../../supabase/functions/notes/noteQueries';

export const editNoteCommand: Command = {
  name: 'edit-note',
  description: 'Edit an existing note. Usage: notes edit-note <note-id> "<new content>"',
  parameters: [
    {
      name: 'noteId',
      description: 'ID of the note to edit',
      required: true,
      type: 'number'
    },
    {
      name: 'content',
      description: 'New content (wrap in quotes)',
      required: true,
      type: 'string'
    }
  ],
  handler: async (args) => {
    try {
      const success = await editNote(args.noteId, args.content);
      if (success) {
        return {
          output: `✅ Successfully updated note #${args.noteId}`
        };
      }
      return {
        output: '❌ Failed to edit note.'
      };
    } catch (error) {
      return {
        output: `❌ Error editing note: ${error}`
      };
    }
  }
};