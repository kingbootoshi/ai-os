import { scraper } from '../twitterClient';
import type { Tweet } from 'goat-x';
import { formatTimestamp } from '../../utils/formatTimestamps';
import { hasInteractedWithTweet, debugTweetInteractions } from '../../supabase/functions/twitter/tweetInteractionChecks';
import { logger } from '../../utils/logger';

/**
 * Gets recent tweets from a specific user
 * @param username - Twitter username (without @ symbol)
 * @param maxTweets - Maximum number of tweets to fetch
 * @returns Array of formatted tweet strings
 */
export async function getTweets(username: string, maxTweets: number): Promise<string[]> {
  try {
    logger.info(`Fetching tweets from @${username}...`);
    const rawTweets: Tweet[] = [];

    // First collect all raw tweets
    for await (const tweet of scraper.getTweets(username, maxTweets)) {
      rawTweets.push(tweet);
    }

    logger.info(`Found ${rawTweets.length} total tweets, checking for previous interactions...`);

    // Filter out already interacted tweets
    const unhandledTweets = await Promise.all(
      rawTweets.map(async (tweet) => {
        const hasInteracted = await hasInteractedWithTweet(tweet.id!);
        if (hasInteracted) {
          await debugTweetInteractions(tweet.id!);
          logger.info(`Filtering out tweet ${tweet.id} - already interacted with`);
          return null;
        }
        return tweet;
      })
    );

    // Format remaining tweets
    const formattedTweets = unhandledTweets
      .filter((tweet): tweet is Tweet => tweet !== null)
      .map(tweet => {
        const timestamp = tweet.timeParsed ? 
          formatTimestamp(new Date(tweet.timeParsed)) :
          'Unknown time';
          
        return `- [${tweet.id}] @${tweet.username || 'unknown_user'} (${timestamp}): ${tweet.text}`;
      });

    logger.info(`Returning ${formattedTweets.length} formatted tweets after filtering`);
    return formattedTweets;

  } catch (error) {
    logger.error('Error fetching tweets:', error);
    return [];
  }
} 