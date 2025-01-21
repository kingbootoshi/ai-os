import { supabase } from '../../supabaseClient';
import { logger } from '../../../utils/logger';
import { findTwitterUserByTwitterId, createTwitterUser } from './userEntries';
import { getTwitterUserInfo } from '../../../twitter/utils/profileUtils';

export async function isUserFollowedByBot(username: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_accounts')
      .select(`
        id,
        twitter_user_accounts!inner (
          is_followed_by_bot
        )
      `)
      .eq('platform', 'twitter')
      .eq('username', username)
      .maybeSingle();

    return data?.twitter_user_accounts?.is_followed_by_bot || false;
  } catch (error) {
    logger.error('Error checking if user is followed:', error);
    return false;
  }
}

export async function updateUserFollowStatus(
  username: string,
  twitterId: string
): Promise<boolean> {
  try {
    let userResult = await findTwitterUserByTwitterId(twitterId);

    if (!userResult) {
      logger.info(`New user detected: @${username}. Fetching profile info...`);
      const userInfo = await getTwitterUserInfo(username);
      
      if (!userInfo) {
        logger.error('Failed to get Twitter profile info');
        return false;
      }

      userResult = await createTwitterUser(username, twitterId, userInfo.profile);
      if (!userResult) {
        logger.error('Failed to create user record');
        return false;
      }
    }

    const { error } = await supabase
      .from('twitter_user_accounts')
      .update({ 
        is_followed_by_bot: true,
        last_followed_at: new Date().toISOString()
      })
      .eq('user_account_id', userResult.userAccountId);

    if (error) {
      logger.error('Error updating follow status:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error in updateUserFollowStatus:', error);
    return false;
  }
}