import { scraper } from '../twitterClient';
import { likeTweet } from './likeTweet';
import { analyzeTweetContext } from '../utils/tweetUtils';
import { findOrCreateUserFromTweet } from '../utils/profileUtils';
import { logger } from '../../utils/logger';
import { logTweet } from '../../supabase/functions/twitter/tweetEntries';
import { logTwitterInteraction } from '../../supabase/functions/twitter/interactionEntries';
import { hasAlreadyActioned } from '../../supabase/functions/twitter/tweetInteractionChecks';
import { RetweetResult } from '../types/tweetResults';

/**
 * Retweets a specific tweet
 * @param tweetId - The ID of the tweet to retweet
 * @returns Promise<RetweetResult> with status and details
 */
export async function retweet(tweetId: string): Promise<RetweetResult> {
  try {
    // Check if already retweeted
    logger.info(`Checking if tweet ${tweetId} was already retweeted...`);
    const hasRetweeted = await hasAlreadyActioned(tweetId, 'retweet');
    
    if (hasRetweeted) {
      const message = `Already retweeted tweet ${tweetId}`;
      logger.info(message);
      return {
        success: false,
        message
      };
    }

    // Fetch the tweet we're retweeting
    const targetTweet = await scraper.getTweet(tweetId);
    if (!targetTweet || !targetTweet.username) {
      const message = 'Failed to fetch target tweet';
      logger.error(message);
      return {
        success: false,
        message
      };
    }

    // Like the tweet before retweeting
    await likeTweet(tweetId);

    try {
      // Attempt to retweet
      await scraper.retweet(tweetId);
    } catch (error) {
      const message = `Failed to retweet: ${error}`;
      logger.error(message);
      return {
        success: false,
        message
      };
    }

    logger.info(`Successfully retweeted tweet ${tweetId}`);

    // Generate a unique composite ID for the retweet entry
    const uniqueRetweetId = `rt_${tweetId}`;

    // Log the bot's retweet in the database with the unique composite ID
    const logResult = await logTweet({
      tweet_id: uniqueRetweetId, // Use composite ID instead of null
      text: targetTweet.text || '',
      tweet_type: 'retweet',
      retweeted_tweet_id: tweetId,
      created_at: new Date().toISOString(),
    });

    if (!logResult) {
      logger.info('Warning: Failed to log retweet in database');
    }

    // Find or create user account
    const userAccounts = await findOrCreateUserFromTweet(targetTweet);
    if (!userAccounts) {
      const message = 'Failed to process user account';
      logger.error(message);
      return {
        success: false,
        message
      };
    }

    // Analyze the context of the tweet for logging
    const context = await analyzeTweetContext(targetTweet);

    // Log the interaction with the user
    await logTwitterInteraction({
      tweetId: tweetId,
      userTweetText: targetTweet.text || '',
      userTweetTimestamp: targetTweet.timeParsed?.toISOString() || new Date().toISOString(),
      userId: userAccounts.userId || '',
      context,
    });

    return {
      success: true,
      message: 'Successfully retweeted tweet'
    };

  } catch (error) {
    const message = `Error retweeting tweet: ${error}`;
    logger.info(message);
    return {
      success: false,
      message
    };
  }
} 