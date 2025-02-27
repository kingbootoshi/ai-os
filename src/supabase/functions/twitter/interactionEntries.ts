import { supabase } from '../../supabaseClient';
import { logger } from '../../../utils/logger';

interface TweetInteractionData {
  tweetId: string;
  userTweetText: string;
  userTweetTimestamp: string;
  userId: string;
  context?: {
    type: 'mention' | 'reply_to_bot' | 'reply_to_others' | 'quote_tweet' | 'retweet' | null;
    parentTweetId?: string;
    parentTweetAuthor?: string;
  };
}

export async function logTwitterInteraction(
  data: TweetInteractionData
): Promise<string | null> {
  try {
    const { data: interaction, error } = await supabase
      .from('twitter_interactions')
      .upsert(
        {
          tweet_id: data.tweetId,
          user_id: data.userId,
          bot_username: process.env.TWITTER_USERNAME,
          context: data.context || null,
          text: data.userTweetText,
          timestamp: data.userTweetTimestamp
        },
        {
          onConflict: 'tweet_id',
          ignoreDuplicates: true
        }
      )
      .select('id')
      .single();

    if (error) {
      if (error.code !== '23505') {
        logger.error('Error logging interaction:', error);
      }
      return null;
    }

    return interaction.id.toString();
  } catch (error) {
    logger.error('Error in logTwitterInteraction:', error);
    return null;
  }
}