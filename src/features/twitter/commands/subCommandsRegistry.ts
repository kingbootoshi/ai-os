import { Command } from '../../../terminal/types/commands';
import { twitterGetTweets } from './getTweets';
import { twitterRetweet } from './retweet';
import { twitterSearch } from './search';
import { twitterReply } from './reply';
import { twitterFollow } from './follow';
import { twitterGetMentions } from './getMentions';
import { twitterQuote } from './quote';
import { twitterGetHomepage } from './getHomepage';
import { twitterTweet } from './postTweet';
import { twitterGetThread } from './getThread';

export const twitterSubCommands: Command[] = [
  twitterGetTweets,
  twitterRetweet,
  twitterSearch,
  twitterReply,
  twitterFollow,
  twitterGetMentions,
  twitterQuote,
  twitterGetHomepage,
  twitterTweet,
  twitterGetThread
];