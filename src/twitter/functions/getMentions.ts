import { scraper } from '../twitterClient';
import type { Tweet } from 'goat-x';
import { formatTimestamp } from '../../utils/formatTimestamps';
import { hasInteractedWithTweet, debugTweetInteractions } from '../../supabase/functions/twitter/tweetInteractionChecks';
import { isUserFollowedByBot } from '../../supabase/functions/twitter/followEntries';
import { logger } from '../../utils/logger';

interface ExtendedTweet extends Tweet {
  originalTweetText?: string;
  originalTweetAuthor?: string;
  originalTweetId?: string;
  isFollowing?: boolean;
}

/**
 * Gets recent mentions of the bot's account
 * @param maxTweets - Maximum number of mentions to fetch (default: 20)
 * @returns Array of formatted mention strings
 */
export async function getMentions(maxTweets: number = 20): Promise<string[]> {
  try {
    logger.info('Fetching mentions...');
    const rawMentions: Tweet[] = [];
    const query = `@${process.env.TWITTER_USERNAME}`;
    const searchMode = 1; // SearchMode.Latest

    // First just collect all raw mentions
    for await (const tweet of scraper.searchTweets(query, maxTweets, searchMode)) {
      if (tweet.username !== process.env.TWITTER_USERNAME && tweet.id) {
        rawMentions.push(tweet);
      }
    }

    logger.info(`Found ${rawMentions.length} total mentions, checking for previous interactions...`);

    // Filter out already interacted tweets first
    const unhandledMentions = await Promise.all(
      rawMentions.map(async (tweet) => {
        const hasInteracted = await hasInteractedWithTweet(tweet.id!);
        if (hasInteracted) {
          await debugTweetInteractions(tweet.id!);
          logger.info(`Filtering out tweet ${tweet.id} - already interacted with`);
          return null;
        }
        return tweet;
      })
    );

    // Process only unhandled mentions
    const processedMentions: ExtendedTweet[] = [];
    for (const tweet of unhandledMentions.filter((t): t is Tweet => t !== null)) {
      logger.info(`Processing unhandled mention from @${tweet.username} (ID: ${tweet.id})`);
      const extendedTweet = tweet as ExtendedTweet;

      // Add following status
      if (extendedTweet.username) {
        const isFollowing = await isUserFollowedByBot(extendedTweet.username);
        extendedTweet.isFollowing = isFollowing;
        logger.info(`Following status for @${extendedTweet.username}: ${isFollowing}`);
      }

      // Fetch original tweet if it's a reply
      if (extendedTweet.inReplyToStatusId) {
        try {
          logger.info(`Fetching parent tweet ${extendedTweet.inReplyToStatusId}...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          const originalTweet = await scraper.getTweet(extendedTweet.inReplyToStatusId);
          if (originalTweet && originalTweet.text) {
            extendedTweet.originalTweetText = originalTweet.text;
            extendedTweet.originalTweetAuthor = originalTweet.username;
            extendedTweet.originalTweetId = originalTweet.id;
            logger.info(`Found parent tweet from @${originalTweet.username}`);
          }
        } catch (error) {
          logger.error(`Failed to fetch parent tweet: ${error}`);
        }
      }

      processedMentions.push(extendedTweet);
    }

    // Format the processed mentions
    const formattedMentions = processedMentions.map(mention => {
      const timestamp = mention.timeParsed ? 
        formatTimestamp(new Date(mention.timeParsed)) :
        'Unknown time';
      
      let output = `- [${mention.id}] @${mention.username} (${mention.isFollowing ? 'Following' : 'Not following'}) (${timestamp}): ${mention.text}`;
      
      if (mention.originalTweetText && mention.originalTweetAuthor) {
        const isBot = mention.originalTweetAuthor === process.env.TWITTER_USERNAME;
        const authorDisplay = isBot ? `@${mention.originalTweetAuthor} (YOU)` : `@${mention.originalTweetAuthor}`;
        const tweetIdDisplay = mention.originalTweetId ? `[${mention.originalTweetId}]` : '';
        
        output += `\n  ↳ In reply to ${authorDisplay} ${tweetIdDisplay}: "${mention.originalTweetText}"`;
      }
      
      return output;
    });

    logger.info(`Returning ${formattedMentions.length} formatted mentions`);
    return formattedMentions;

  } catch (error) {
    logger.error('Error fetching mentions:', error);
    return [];
  }
} 