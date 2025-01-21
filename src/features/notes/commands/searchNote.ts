import { Command } from '../../../terminal/types/commands';
import { searchNotes } from '../../../supabase/functions/notes/noteQueries';

export const searchNoteCommand: Command = {
  name: 'search-note',
  description: 'Search notes semantically. Usage: notes search-note "<query>"',
  parameters: [
    {
      name: 'query',
      description: 'Search query (wrap in quotes)',
      required: true,
      type: 'string'
    }
  ],
  handler: async (args) => {
    try {
      const results = await searchNotes(args.query);
      if (results.length === 0) {
        return {
          output: `No matching notes found for "${args.query}".`
        };
      }

      const formatted = results.map(n => `ID: ${n.id} | Content: "${n.content}"`).join('\n');
      return {
        output: `Top matches for "${args.query}":\n${formatted}`
      };
    } catch (error) {
      return {
        output: `❌ Error searching notes: ${error}`
      };
    }
  }
};