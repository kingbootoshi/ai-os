import { supabase } from '../../supabaseClient';
import { uploadAndLogMedia } from './mediaEntries';
import { logger } from '../../../utils/logger';
import { formatTimestamp } from '../../../utils/formatTimestamps';

interface TweetData {
  tweet_id?: string | null;
  text: string;
  tweet_type: 'main' | 'reply' | 'quote' | 'retweet';
  has_media?: boolean;
  bot_username?: string;
  in_reply_to_tweet_id?: string;
  retweeted_tweet_id?: string;
  quoted_tweet_id?: string;
  created_at?: string;
}

export async function logTweet(
  data: TweetData,
  mediaData?: { data: Buffer; mediaType: string; }[]
): Promise<string | null> {
  try {
    let mediaIds: string[] | null = null;

    if (mediaData && mediaData.length > 0 && data.tweet_id) {
      const mediaIdResults = await Promise.all(
        mediaData.map(async ({ data: mediaBuffer, mediaType }) => {
          try {
            return await uploadAndLogMedia(mediaBuffer, data.tweet_id!, mediaType);
          } catch (error) {
            logger.error('Error processing media:', error);
            return null;
          }
        })
      );

      mediaIds = mediaIdResults.filter((id): id is string => id !== null);
    }

    const currentTime = new Date().toISOString();
    const insertData = {
      tweet_id: data.tweet_id || (data.tweet_type === 'retweet' ? 
        `rt_${data.retweeted_tweet_id}` : null),
      text: data.text.trim(),
      tweet_type: data.tweet_type,
      has_media: mediaData && mediaData.length > 0 ? true : false,
      bot_username: data.bot_username || process.env.TWITTER_USERNAME,
      in_reply_to_tweet_id: data.in_reply_to_tweet_id,
      retweeted_tweet_id: data.retweeted_tweet_id,
      quoted_tweet_id: data.quoted_tweet_id,
      created_at: currentTime,
    };

    logger.info(`Logging tweet with created_at: ${insertData.created_at}`);

    if (new Date(insertData.created_at) > new Date()) {
      logger.info(`Error: Attempted to set created_at to a future time.`);
      insertData.created_at = new Date().toISOString();
    }

    const { data: tweet, error } = await supabase
      .from('twitter_tweets')
      .insert(insertData)
      .select('tweet_id')
      .maybeSingle();

    if (error) {
      logger.error('Error logging tweet to Supabase:', error.message);
      logger.error('Error details:', error.details);
      logger.error('Error hint:', error.hint);
      return null;
    }

    if (mediaIds && mediaIds.length > 0 && data.tweet_id) {
      const mediaRelations = mediaIds.map((mediaId) => ({
        tweet_id: data.tweet_id!,
        media_id: mediaId,
      }));

      const { error: mediaRelationError } = await supabase
        .from('tweet_media')
        .insert(mediaRelations);

      if (mediaRelationError) {
        logger.error('Error creating media relations:', mediaRelationError);
      }
    }

    logger.info('Successfully logged tweet to Supabase:', tweet);
    return tweet?.tweet_id || null;
  } catch (error) {
    logger.error('Exception in logTweet:', error);
    return null;
  }
}

export async function getRecentMainTweets(): Promise<string | null> {
  try {
    const { data: tweets, error } = await supabase
      .from('twitter_tweets')
      .select('*')
      .eq('tweet_type', 'main')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      logger.error('Error fetching recent tweets:', error);
      return null;
    }

    if (!tweets || tweets.length === 0) {
      return "No recent main tweets found.";
    }

    const formattedTweets = tweets.map(tweet => {
      const timestamp = formatTimestamp(tweet.created_at || new Date().toISOString());
      const mediaIndicator = tweet.has_media ? '[has media]' : '[no media]';
      return `[${timestamp}] - ${tweet.text} ${mediaIndicator}`;
    });

    return formattedTweets.reverse().join('\n');
  } catch (error) {
    logger.error('Exception in getRecentMainTweets:', error);
    return null;
  }
}