import { Command } from '../../../terminal/types/commands';
import { queryPerplexity } from '../internetTool';

export const searchWeb: Command = {
  name: 'search-web',
  description: 'Search the web for information and get a summary. Query MUST be in quotes.',
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
      const result = await queryPerplexity(args.query);
      return {
        output: `Search Results for "${args.query}":\n\n${result}`
      };
    } catch (error: any) {
      return {
        output: `Error searching web: ${error.message || error}`
      };
    }
  }
};
