import { Command } from '../../../terminal/types/commands';
import { searchTwitter } from '../../../twitter/functions/searchTwitter';

/**
 * @command search-twitter
 * @description Search for tweets with a specific query
 */
export const twitterSearch: Command = {
  name: 'search-twitter',
  description: 'Search for tweets with a specific query',
  parameters: [
    {
      name: 'query',
      description: 'Search query string',
      required: true,
      type: 'string'
    },
    {
      name: 'limit',
      description: 'Maximum number of results to return',
      required: false,
      type: 'number',
      defaultValue: '20'
    }
  ],
  handler: async (args) => {
    try {
      const results = await searchTwitter(args.query, args.limit);
      // Join array results and handle errors appropriately
      const formattedResults = Array.isArray(results) ? results.join('\n') : results;
      return {
        output: formattedResults.includes('Error')
          ? `❌ ${formattedResults}`
          : `🔍 ${formattedResults}\nTo get the full thread of a tweet to reply, use twitter get-thread <tweetid>`
      };
    } catch (error: unknown) { // Type annotation for error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        output: `❌ Error searching tweets: ${errorMessage}`
      };
    }
  }
}; 