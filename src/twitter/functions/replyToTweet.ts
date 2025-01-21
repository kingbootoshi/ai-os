import { scraper } from '../twitterClient';
import { prepareMediaData } from '../utils/mediaUtils';
import { likeTweet } from './likeTweet';
import { analyzeTweetContext } from '../utils/tweetUtils';
import { findOrCreateUserFromTweet } from '../utils/profileUtils';
import { logger } from '../../utils/logger';
import { logTweet } from '../../supabase/functions/twitter/tweetEntries';
import { logTwitterInteraction } from '../../supabase/functions/twitter/interactionEntries';
import { hasAlreadyActioned } from '../../supabase/functions/twitter/tweetInteractionChecks';
import { ReplyResult } from '../types/tweetResults';

/**
 * Extracts tweet ID from response based on tweet type
 * @param responseData - API response data
 * @param isLongTweet - Whether this was a long tweet
 * @returns Tweet ID or null
 */
function extractTweetId(responseData: any, isLongTweet: boolean): string | null {
  try {
    if (isLongTweet) {
      // Path for long tweets (notetweets)
      return responseData?.data?.notetweet_create?.tweet_results?.result?.rest_id;
    } else {
      // Path for regular tweets
      return responseData?.data?.create_tweet?.tweet_results?.result?.rest_id;
    }
  } catch (error) {
    logger.info('Error extracting tweet ID:', error);
    return null;
  }
}

/**
 * Replies to a specific tweet and logs the interaction
 * @param replyToTweetId - The ID of the tweet to reply to
 * @param text - The text content of the reply
 * @param mediaUrls - Optional array of media URLs
 * @param twitterInterface - Optional Twitter interface context
 * @returns The ID of the reply tweet, or null if failed
 */
export async function replyToTweet(
  replyToTweetId: string,
  text: string,
  mediaUrls?: string[],
  twitterInterface?: string
): Promise<ReplyResult> {
  try {
    // Check if the bot has already replied to the tweet
    const hasReplied = await hasAlreadyActioned(replyToTweetId, 'reply');
    if (hasReplied) {
      logger.info(`Already replied to tweet ${replyToTweetId}`);
      return {
        success: false,
        message: 'Already replied to this tweet'
      };
    }

    // Get the tweet we're replying to
    const targetTweet = await scraper.getTweet(replyToTweetId);
    if (!targetTweet || !targetTweet.username) {
      logger.error('Failed to fetch target tweet');
      return {
        success: false,
        message: 'Failed to fetch target tweet'
      };
    }

    // Prepare media data for Twitter API
    const mediaData = mediaUrls ? await prepareMediaData(mediaUrls) : undefined;

    // Like the tweet before replying
    await likeTweet(replyToTweetId);

    // Check if reply exceeds standard character limit
    const isLongTweet = text.length > 280;
    
    // Send reply using appropriate method based on length
    const response = isLongTweet 
      ? await scraper.sendLongTweet(text, replyToTweetId, mediaData)
      : await scraper.sendTweet(text, replyToTweetId, mediaData);
      
    logger.info("RAW RESPONSE", response);
    const responseData = await response.json();
    const replyTweetId = extractTweetId(responseData, isLongTweet);

    if (!replyTweetId) {
      logger.error('Failed to retrieve reply tweet ID from response:', responseData);
      return {
        success: false,
        message: 'Failed to retrieve reply tweet ID from response'
      };
    }

    logger.info(`${isLongTweet ? 'Long reply' : 'Reply'} sent successfully (ID: ${replyTweetId})`);

    // Log the bot's reply tweet
    const tweetLogResult = await logTweet({
      tweet_id: replyTweetId,
      text: text,
      tweet_type: 'reply',
      has_media: !!mediaData,
      in_reply_to_tweet_id: replyToTweetId,
      created_at: new Date().toISOString()
    }, mediaData);

    if (!tweetLogResult) {
      logger.error('Failed to log reply tweet');
    }

    // Find or create user account
    const userAccounts = await findOrCreateUserFromTweet(targetTweet);
    if (!userAccounts) {
      logger.info('Failed to process user account');
      return {
        success: false,
        message: 'Failed to process user account'
      };
    }

    // Analyze tweet context
    const context = {
      ...(await analyzeTweetContext(targetTweet)),
      twitterInterface: twitterInterface
    };

    // Log the interaction with enhanced context
    await logTwitterInteraction({
      tweetId: replyToTweetId,
      userTweetText: targetTweet.text || '',
      userTweetTimestamp: targetTweet.timeParsed?.toISOString() || new Date().toISOString(),
      userId: userAccounts.userId || '',
      context
    });

    return {
      success: true,
      message: 'Successfully replied to tweet',
      tweetId: replyTweetId
    };

  } catch (error) {
    logger.error('Error sending reply:', error);
    return {
      success: false,
      message: `Failed to reply: ${error}`
    };
  }
} 