import { supabase } from '../../supabaseClient';
import { logger } from '../../../utils/logger';
import { Profile } from 'goat-x';

function sanitizeProfileForJson(profile: Partial<Profile>): Record<string, any> {
  return {
    ...profile,
    joined: profile.joined?.toISOString(),
  };
}

type TwitterUserResult = {
  userAccountId: number;
  userId: string | null;
} | null;

export async function findTwitterUserByTwitterId(
  twitterId: string
): Promise<TwitterUserResult> {
  try {
    const { data: existingAccount } = await supabase
      .from('user_accounts')
      .select('id, user_id')
      .eq('platform', 'twitter')
      .eq('platform_user_id', twitterId)
      .single();

    if (!existingAccount) {
      return null;
    }

    return {
      userAccountId: existingAccount.id,
      userId: existingAccount.user_id
    };
  } catch (error) {
    logger.error('Error in findTwitterUser:', error);
    return null;
  }
}

export async function findTwitterUserByUsername(
  username: string
): Promise<TwitterUserResult> {
  try {
    const { data: existingAccount } = await supabase
      .from('user_accounts')
      .select('id, user_id')
      .eq('platform', 'twitter')
      .eq('username', username)
      .single();

    if (!existingAccount) {
      return null;
    }

    return {
      userAccountId: existingAccount.id,
      userId: existingAccount.user_id
    };
  } catch (error) {
    logger.error('Error in findTwitterUserByUsername:', error);
    return null;
  }
}

export async function updateTwitterUserProfile(
  userAccountId: number,
  profileData: Partial<Profile>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('twitter_user_accounts')
      .update({ 
        profile_data: sanitizeProfileForJson(profileData),
        last_profile_update: new Date().toISOString()
      })
      .eq('user_account_id', userAccountId);

    return !error;
  } catch (error) {
    logger.error('Error updating Twitter user profile:', error);
    return false;
  }
}

export async function createTwitterUser(
  username: string,
  twitterId: string,
  profileData?: Partial<Profile>
): Promise<TwitterUserResult> {
  try {
    const { data: newUser } = await supabase
      .from('users')
      .insert({
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (!newUser) {
      logger.error('Failed to create new user');
      return null;
    }

    const { data: newAccount } = await supabase
      .from('user_accounts')
      .insert({
        user_id: newUser.id,
        platform: 'twitter',
        platform_user_id: twitterId,
        username: username,
        connected_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (!newAccount) {
      logger.error('Failed to create user account');
      return null;
    }

    const { error: twitterError } = await supabase
      .from('twitter_user_accounts')
      .insert({
        user_account_id: newAccount.id,
        is_followed_by_bot: null,
        profile_data: profileData ? sanitizeProfileForJson(profileData) : null,
        last_profile_update: new Date().toISOString()
      });

    if (twitterError) {
      logger.error('Error creating twitter user account:', twitterError);
      return null;
    }

    return {
      userAccountId: newAccount.id,
      userId: newUser.id
    };
  } catch (error) {
    logger.error('Error in createTwitterUser:', error);
    return null;
  }
}