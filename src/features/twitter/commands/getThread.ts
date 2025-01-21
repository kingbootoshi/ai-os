import { Command } from '../../../terminal/types/commands';
import { assembleTwitterInterface } from '../../../twitter/utils/imageUtils';

/**
 * @command get-thread
 * @description Get the full conversation thread for a tweet
 */
export const twitterGetThread: Command = {
  name: 'get-thread',
  description: 'Get the full conversation thread for a specified tweet ID',
  parameters: [
    {
      name: 'tweetId',
      description: 'ID of the tweet to get the thread for',
      required: true,
      type: 'string'
    }
  ],
  handler: async (args) => {
    try {
      // Get the thread content using assembleTwitterInterface
      const { textContent } = await assembleTwitterInterface(args.tweetId);
      
      return {
        output: textContent || '📭 No content found for this tweet thread.'
      };
    } catch (error) {
      return {
        output: `❌ Error fetching tweet thread: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}; 