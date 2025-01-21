import { supabase } from '../../supabaseClient';
import { logger } from '../../../utils/logger';

export interface TwitterInteractionResult {
  formattedString: string;
  userId: string;
}

export async function linkTwitterInteractions(tweetId: string): Promise<TwitterInteractionResult | null> {
  try {
    logger.info('Starting Twitter interaction linking process...');
    logger.info(`Looking up tweet ID: ${tweetId}`);

    const { data: interactionData, error: interactionError } = await supabase
      .from('twitter_interactions')
      .select(`
        *,
        users!inner(*)
      `)
      .eq('tweet_id', tweetId)
      .single();

    if (interactionError) {
      logger.error('Error fetching interaction:', interactionError);
      return null;
    }

    if (!interactionData) {
      logger.info('No interaction found for tweet ID');
      return null;
    }

    logger.info('Found interaction data:', interactionData);

    if (!interactionData.user_id) {
      logger.info('interactionData.user_id is null');
      return null;
    }

    const { data: userAccountData, error: userAccountError } = await supabase
      .from('user_accounts')
      .select(`
        *,
        twitter_user_accounts(*)
      `)
      .eq('user_id', interactionData.user_id)
      .eq('platform', 'twitter')
      .single();

    if (userAccountError) {
      logger.error('Error fetching user account:', userAccountError);
      return null;
    }

    logger.info('Found user account data:', userAccountData);

    const { data: botResponses, error: botResponseError } = await supabase
      .from('twitter_tweets')
      .select('*')
      .or(`in_reply_to_tweet_id.eq.${tweetId},retweeted_tweet_id.eq.${tweetId},quoted_tweet_id.eq.${tweetId}`);

    if (botResponseError) {
      logger.error('Error fetching bot responses:', botResponseError);
      return null;
    }

    logger.info('Found bot responses:', botResponses);

    const userId: string = interactionData.user_id;

    let formattedInteraction = `
=== TWITTER INTERACTION SUMMARY ===
`;

    const interfaceText = interactionData.context && typeof interactionData.context === 'object' && 'twitterInterface' in interactionData.context
      ? interactionData.context.twitterInterface as string
      : '';

    formattedInteraction += `
[USER PROFILE]
• Internal User ID: ${userId}
• Twitter Username: ${userAccountData.username}`;

    if (interfaceText) {
      const profileMatch = interfaceText.match(/## User Profile:\n((?:- .*\n)*)/);
      if (profileMatch) {
        const profileLines = profileMatch[1].split('\n').filter(line => line.trim());
        profileLines.forEach(line => {
          const cleanLine = line.replace(/- \*\*|\*\*/g, '');
          formattedInteraction += `\n${cleanLine}`;
        });
      }
    }

    if (interfaceText) {
      const parentTweetMatch = interfaceText.match(/### Parent Tweet:\n\[(.*?)\] (.*?):(.*?)(?=\n\n|$)/s);
      if (parentTweetMatch) {
        const [_, timestamp, author, content] = parentTweetMatch;
        formattedInteraction += `\n\n[PARENT TWEET]
• Timestamp: ${timestamp}
• Author: ${author}
• Content: ${content.trim()}`;
      }
    }

    if (interfaceText) {
      const repliesMatch = interfaceText.match(/### Replies Above.*?:(.*?)(?=\n\n## |$)/s);
      if (repliesMatch) {
        formattedInteraction += '\n\n[TWEET THREAD REPLIES TO THE PARENT TWEET, ABOVE CURRENT INTERACTION FOCUS]';
        const replies = repliesMatch[1].trim().split('\n');
        replies.forEach(reply => {
          const replyMatch = reply.match(/\[(.*?)\] (.*?):(.*?)(?=\n|$)/);
          if (replyMatch) {
            const [_, timestamp, author, content] = replyMatch;
            formattedInteraction += `\n\n• Timestamp: ${timestamp}
• Author: ${author}
• Content: ${content.trim()}`;
          }
        });
      }
    }

    const interactionText = interactionData.text ?? 'No content';
    const interactionTimestamp = interactionData.timestamp ? new Date(interactionData.timestamp).toLocaleString() : 'Unknown';

    formattedInteraction += `
    
[CURRENT TWEET FOCUS]
• Content: ${interactionText}
• Timestamp: ${interactionTimestamp}`;
    formattedInteraction += `
    
[YOUR RESPONSES TO THE FOCUS TWEET]`;

    if (botResponses && botResponses.length > 0) {
      botResponses.forEach(response => {
        const responseTime = response.created_at ? new Date(response.created_at).toLocaleString() : 'Unknown';
        formattedInteraction += `\n\n[${getResponseType(response)}]
• Content: ${response.text}
• Time: ${responseTime}`;
      });
    } else {
      formattedInteraction += '\n• No bot responses recorded';
    }

    if (interfaceText) {
      const historyMatch = interfaceText.match(/## Recent Tweet History.*?\n(.*?)(?=\n\n|$)/s);
      if (historyMatch) {
        formattedInteraction += '\n\n[PAST CONVERSATION HISTORY WITH USER]';
        const history = historyMatch[1].trim().split('\n');
        history.forEach(tweet => {
          const tweetMatch = tweet.match(/\[(.*?)\] (.*?):(.*?)(?=\n|$)/);
          if (tweetMatch) {
            const [_, timestamp, author, content] = tweetMatch;
            formattedInteraction += `\n\n• Timestamp: ${timestamp}
• Author: ${author}
• Content: ${content.trim()}`;
          }
        });
      }
    }

    formattedInteraction += '\n=== END OF SUMMARY ===';

    logger.info('Successfully formatted interaction summary');

    return {
      formattedString: formattedInteraction,
      userId: userId
    };

  } catch (error) {
    logger.error('Unexpected error in linkTwitterInteractions:', error);
    return null;
  }
}

function getResponseType(response: any): string {
  const types: string[] = [];
  
  if (response.in_reply_to_tweet_id) types.push('Reply');
  if (response.retweeted_tweet_id) types.push('Retweet');
  if (response.quoted_tweet_id) types.push('Quote');
  
  return types.length ? `${types.join(' + ')}` : 'Main Tweet';
}