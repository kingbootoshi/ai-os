import { supabase } from '../../supabaseClient';
import { logger } from '../../../utils/logger';

type TweetType = 'main' | 'quote' | 'retweet' | 'media';

const COOLDOWN_DURATION = 60;

function parseTimestampToUTC(timestamp: string): Date {
  const formattedTimestamp = timestamp.replace(' ', 'T') + 'Z';
  return new Date(formattedTimestamp);
}

interface TweetRecord {
  created_at: Date;
  text: string;
  has_media: boolean;
}

async function getLastTweetDetails(tweetType: TweetType): Promise<TweetRecord | null> {
  const { data, error } = await supabase
    .from('twitter_tweets')
    .select('created_at, text, has_media')
    .eq('tweet_type', tweetType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    logger.error(`Error fetching last tweet details for type ${tweetType}:`, error.message);
    return null;
  }

  if (data && data.created_at) {
    const createdAtUTC = parseTimestampToUTC(data.created_at);
    return {
      created_at: createdAtUTC,
      text: data.text || '',
      has_media: data.has_media || false
    };
  } else {
    return null;
  }
}

function logCooldownCheck(
  tweetType: TweetType, 
  lastTweetTime: Date | null, 
  currentTime: Date, 
  timeSinceLastTweet: number, 
  cooldownPeriod: number, 
  text: string | null | undefined
) {
  logger.info(`\n=== Cooldown Check for ${tweetType.toUpperCase()} tweet ===`);
  logger.info(`Last Tweet Time (UTC): ${lastTweetTime?.toISOString() || 'No previous tweet'}`);
  logger.info(`Current Time (UTC): ${currentTime.toISOString()}`);
  logger.info(`Time Since Last Tweet (ms): ${timeSinceLastTweet}`);
  logger.info(`Cooldown Period (ms): ${cooldownPeriod}`);
  if (text) logger.info(`Last Tweet Text: ${text}`);
  logger.info(`Time remaining: ${Math.max(0, (cooldownPeriod - timeSinceLastTweet) / (60 * 1000)).toFixed(2)} minutes`);
  logger.info(`=====================================\n`);
}

export async function isCooldownActive(tweetType: TweetType): Promise<{ isActive: boolean; remainingTime: number | null }> {
  if (tweetType === 'media') {
    logger.info("\n🖼️ Checking MEDIA tweet cooldown...");
    const [mediaLastTweet, mainWithMediaResult] = await Promise.all([
      getLastTweetDetails('media'),
      supabase
        .from('twitter_tweets')
        .select('created_at, text, has_media')
        .eq('tweet_type', 'main')
        .eq('has_media', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => {
          logger.info("Main tweet with media query result:", data);
          return data ? {
            created_at: parseTimestampToUTC(data.created_at || new Date().toISOString()),
            text: data.text || '',
            has_media: true
          } : null;
        })
    ]);

    logger.info("Dedicated media tweet:", mediaLastTweet);
    logger.info("Main tweet with media:", mainWithMediaResult);

    let lastMediaTweet: TweetRecord | null = null;
    if (mediaLastTweet && mainWithMediaResult) {
      lastMediaTweet = mainWithMediaResult.created_at > mediaLastTweet.created_at ? mainWithMediaResult : mediaLastTweet;
    } else {
      lastMediaTweet = mediaLastTweet || mainWithMediaResult;
    }

    if (!lastMediaTweet) {
      return { isActive: false, remainingTime: null };
    }

    const currentTime = new Date();
    const timeSinceLastTweet = currentTime.getTime() - lastMediaTweet.created_at.getTime();
    const cooldownPeriod = COOLDOWN_DURATION * 60 * 1000;

    const isActive = timeSinceLastTweet < cooldownPeriod;
    const remainingTime = isActive ? Math.ceil((cooldownPeriod - timeSinceLastTweet) / (60 * 1000)) : null;

    return { isActive, remainingTime };
  }

  if (tweetType === 'main') {
    logger.info("\n📝 Checking MAIN tweet cooldown...");
    const { data, error } = await supabase
      .from('twitter_tweets')
      .select('created_at, text, has_media')
      .eq('tweet_type', 'main')
      .eq('has_media', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    logger.info("Main tweet query result:", data);
    if (error) logger.error("Error fetching main tweet:", error.message);

    if (!data) {
      logger.info("No previous main tweets found");
      return { isActive: false, remainingTime: null };
    }

    const lastTweetTime = parseTimestampToUTC(data.created_at || new Date().toISOString());
    const currentTime = new Date();
    let timeSinceLastTweet = currentTime.getTime() - lastTweetTime.getTime();
    const cooldownPeriod = COOLDOWN_DURATION * 60 * 1000;

    logCooldownCheck('main', lastTweetTime, currentTime, timeSinceLastTweet, cooldownPeriod, data.text);

    const isActive = timeSinceLastTweet < cooldownPeriod;
    const remainingTime = isActive ? Math.ceil((cooldownPeriod - timeSinceLastTweet) / (60 * 1000)) : null;

    return { isActive, remainingTime };
  }

  const lastTweetDetails = await getLastTweetDetails(tweetType);
  logger.info(`lastTweetDetails: ${lastTweetDetails}`);
  
  if (!lastTweetDetails) {
    logger.info(`No previous tweets of type ${tweetType}. Cooldown not active.`);
    return {
      isActive: false,
      remainingTime: null
    };
  }

  const lastTweetTime = lastTweetDetails.created_at;
  const currentTime = new Date();
  let timeSinceLastTweet = currentTime.getTime() - lastTweetTime.getTime();
  const cooldownPeriod = COOLDOWN_DURATION * 60 * 1000;

  logCooldownCheck(
    tweetType,
    lastTweetTime || null,
    currentTime,
    timeSinceLastTweet,
    cooldownPeriod,
    lastTweetDetails.text
  );

  if (timeSinceLastTweet < 0) {
    logger.info(`Warning: Last tweet time is in the future. Adjusting timeSinceLastTweet to 0.`);
    timeSinceLastTweet = 0;
  }

  const isActive = timeSinceLastTweet < cooldownPeriod;
  const remainingTime = isActive ? Math.ceil((cooldownPeriod - timeSinceLastTweet) / (60 * 1000)) : null;

  logger.info(`Cooldown Active: ${isActive}`);
  if (isActive) {
    logger.info(`Remaining Cooldown Time (minutes): ${remainingTime}`);
  }

  return {
    isActive,
    remainingTime
  };
}

export async function getCooldownStatus(): Promise<string> {
  const [mainCooldown, quoteCooldown, retweetCooldown, mediaCooldown] = await Promise.all([
    isCooldownActive('main'),
    isCooldownActive('quote'),
    isCooldownActive('retweet'),
    isCooldownActive('media'),
  ]);

  return `Tweet Cooldown Status:
  Main Tweet: ${mainCooldown.isActive ? `CANNOT SEND A MAIN TWEET. COOLDOWN IS ACTIVE (${mainCooldown.remainingTime} minutes remaining)` : 'CAN SEND A MAIN TWEET. COOLDOWN IS INACTIVE'}
  Quote Tweet: ${quoteCooldown.isActive ? `CANNOT SEND A QUOTE TWEET. COOLDOWN IS ACTIVE (${quoteCooldown.remainingTime} minutes remaining)` : 'CAN SEND A QUOTE TWEET. COOLDOWN IS INACTIVE'}
  Retweet: ${retweetCooldown.isActive ? `CANNOT RETWEET. COOLDOWN IS ACTIVE (${retweetCooldown.remainingTime} minutes remaining)` : 'CAN RETWEET. COOLDOWN IS INACTIVE'}
  Media Tweet: ${mediaCooldown.isActive ? `CANNOT SEND A MEDIA TWEET. COOLDOWN IS ACTIVE (${mediaCooldown.remainingTime} minutes remaining)` : 'CAN SEND A MEDIA TWEET. COOLDOWN IS INACTIVE'}`;
}