import { Command } from '../../../terminal/types/commands';
import { getHomepage } from '../../../twitter/functions/getHomepage';

/**
 * @command get-homepage
 * @description Get the homepage of your timeline
 */
export const twitterGetHomepage: Command = {
  name: 'get-homepage',
  description: 'Get the homepage of your timeline',
  parameters: [
    {
      name: 'limit',
      description: 'Maximum number of tweets to fetch',
      required: false,
      type: 'number',
      defaultValue: '20'
    }
  ],
  handler: async (args) => {
    try {
      const tweets = await getHomepage(args.limit);
      if (tweets.length === 0) {
        return {
          output: '📭 No unhandled tweets found in your homepage timeline.'
        };
      }
      return {
        output: `📱 Found ${tweets.length} unhandled tweet${tweets.length === 1 ? '' : 's'} in timeline:\n${tweets.join('\n')}`
          + "\nTo get the full thread of a tweet to reply, use twitter get-thread <tweetid>"
      };
    } catch (error) {
      return {
        output: `❌ Error fetching homepage: ${error}`
      };
    }
  }
}; 