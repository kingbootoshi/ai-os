import { Command } from '../../../terminal/types/commands';
import { followUser } from '../../../twitter/functions/followUser';

export const twitterFollow: Command = {
  name: 'follow',
  description: 'Follow a user. Usage: twitter follow <username>',
  parameters: [
    {
      name: 'username',
      description: 'Username to follow',
      required: true,
      type: 'string'
    }
  ],
  handler: async ({ username }) => {
    try {
      const result = await followUser(username);
      const statusEmoji = {
        success: '✅',
        already_following: 'ℹ️',
        user_not_found: '❌',
        error: '❌'
      }[result.status];

      return {
        output: `${statusEmoji} Action: Follow User\nTarget: @${username}\nStatus: ${result.status}\nDetails: ${result.message}${result.error ? `\nError: ${result.error}` : ''}`
      };
    } catch (error: any) {
      return {
        output: `❌ Action: Follow User\nTarget: @${username}\nStatus: Error\nDetails: ${error.message}`
      };
    }
  }
};