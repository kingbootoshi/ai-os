import { ensureAuthenticated } from '../../twitter/twitterClient';
import { TerminalFeature } from '../featureTypes';
import { Command } from '../../terminal/types/commands';
import { twitter } from './commands/twitter';

const createAuthenticatedHandler = (originalHandler: Command['handler']): Command['handler'] => {
  return async (args) => {
    try {
      await ensureAuthenticated();
      return await originalHandler(args);
    } catch (error) {
      return {
        output: `❌ Authentication Error: ${error instanceof Error ? error.message : 'Failed to authenticate with Twitter'}`
      };
    }
  };
};

const TwitterFeature: TerminalFeature = {
  async loadFeatureCommands(): Promise<Command[]> {
    const authenticatedTwitter: Command = {
      ...twitter,
      handler: createAuthenticatedHandler(twitter.handler)
    };
    
    return [authenticatedTwitter];
  }
};

export default TwitterFeature;