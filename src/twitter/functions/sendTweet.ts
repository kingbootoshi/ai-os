import { scraper } from '../twitterClient';
import { prepareMediaData } from '../utils/mediaUtils';
import { logTweet } from '../../supabase/functions/twitter/tweetEntries';
import { logger } from '../../utils/logger';  

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
    logger.error('Error extracting tweet ID:', error);
    return null;
  }
}

/**
 * Sends a main tweet with optional media and logs it to the database.
 * @param text - The text content of the tweet
 * @param mediaUrls - Optional array of media URLs
 * @returns The ID of the sent tweet, or null if failed
 */
export async function sendTweet(
  text: string,
  mediaUrls?: string[]
): Promise<string | null> {
  try {
    // Prepare media data for Twitter API
    const mediaData = mediaUrls ? await prepareMediaData(mediaUrls) : undefined;

    // Check if tweet exceeds standard character limit
    const isLongTweet = text.length > 280;
    
    // Send tweet using appropriate method based on length
    const response = isLongTweet 
      ? await scraper.sendLongTweet(text, undefined, mediaData)
      : await scraper.sendTweet(text, undefined, mediaData);
      
    logger.info("RAW RESPONSE", response);
    const responseData = await response.json();
    const tweetId = extractTweetId(responseData, isLongTweet);

    if (tweetId) {
      logger.info(`${isLongTweet ? 'Long tweet' : 'Tweet'} sent successfully (ID: ${tweetId})`);

      // Log the tweet to the database with prepared media data
      const logResult = await logTweet({
        tweet_id: tweetId,
        text: text,
        tweet_type: 'main',
        has_media: !!mediaData,
        created_at: new Date().toISOString()
      }, mediaData);

      if (logResult) {
        logger.info(`Tweet logged with ID: ${logResult}`);
      } else {
        logger.info('Failed to log tweet to Supabase.');
      }

      return tweetId;
    } else {
      logger.error('Failed to retrieve tweet ID from response:', responseData);
      return null;
    }
  } catch (error) {
    logger.error('Error sending tweet:', error);
    return null;
  }
}
