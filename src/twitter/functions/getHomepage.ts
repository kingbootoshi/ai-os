import { scraper } from '../twitterClient';
import { formatTimestamp } from '../../utils/formatTimestamps';
import { hasInteractedWithTweet, debugTweetInteractions } from '../../supabase/functions/twitter/tweetInteractionChecks';
import { isUserFollowedByBot } from '../../supabase/functions/twitter/followEntries';
import { logger } from '../../utils/logger';

/**
 * Gets tweets from the homepage timeline
 * @param maxTweets - Maximum number of tweets to fetch (default: 20)
 * @returns Array of formatted tweet strings
 */
export async function getHomepage(maxTweets: number = 20): Promise<string[]> {
  try {
    logger.info(`Fetching homepage tweets (max: ${maxTweets})...`);
    const rawTweets: any[] = [];
    const listId = '1621164352186327041';

    // First collect raw tweets with proper limit
    const response = await scraper.fetchListTweets(listId, maxTweets);
    if (!response || !response.tweets || response.tweets.length === 0) {
      logger.info('No tweets found in response');
      return [];
    }

    // Only take up to maxTweets tweets
    rawTweets.push(...response.tweets.slice(0, maxTweets));
    logger.info(`Found ${rawTweets.length}/${maxTweets} tweets, checking for previous interactions...`);

    // Filter out already interacted tweets and check following status
    const unhandledTweets = await Promise.all(
      rawTweets.map(async (tweet) => {
        const hasInteracted = await hasInteractedWithTweet(tweet.id!);
        if (hasInteracted) {
          await debugTweetInteractions(tweet.id!);
          logger.info(`Filtering out tweet ${tweet.id} - already interacted with`);
          return null;
        }
        
        // Check if we're following the user
        const isFollowing = await isUserFollowedByBot(tweet.username || '');
        return { ...tweet, isFollowing };
      })
    );

    // Format remaining tweets
    const formattedTweets = unhandledTweets
      .filter((tweet): tweet is any => tweet !== null)
      .map(tweet => {
        const timestamp = tweet.timeParsed ? 
          formatTimestamp(new Date(tweet.timeParsed)) :
          'Unknown time';
        
        const followStatus = tweet.isFollowing ? '(FOLLOWING)' : '(NOT FOLLOWING)';
        
        return `- [${tweet.id}] @${tweet.username || 'unknown_user'} ${followStatus} (${timestamp}): ${tweet.text}`;
      });

    logger.info(`Returning ${formattedTweets.length} formatted tweets after filtering`);
    return formattedTweets;

  } catch (error) {
    logger.error('Error fetching homepage tweets:', error);
    return [];
  }
} 