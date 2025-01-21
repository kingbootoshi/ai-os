import { Command } from '../../../terminal/types/commands';
import { listNotes } from '../../../supabase/functions/notes/noteQueries';

export const listNotesCommand: Command = {
  name: 'list-notes',
  description: 'List all notes (up to 50)',
  parameters: [],
  handler: async () => {
    try {
      const notes = await listNotes();
      if (notes.length === 0) {
        return {
          output: 'No notes found.'
        };
      }

      const formatted = notes.map(n => `ID: ${n.id} | Content: "${n.content}"`).join('\n');
      return {
        output: `Here are your notes:\n${formatted}`
      };
    } catch (error) {
      return {
        output: `❌ Error listing notes: ${error}`
      };
    }
  }
};