// scripts/extractTweetActions.ts

import { linkTwitterInteractions, TwitterInteractionResult } from '../../supabase/functions/twitter/linkInteractions';
import { getShortTermHistory } from '../../supabase/functions/terminal/terminalHistory';
import { logger } from '../../utils/logger';
import { findTwitterUserByUsername } from '../../supabase/functions/twitter/userEntries';

interface TweetAction {
  sessionId: string;
  role: string;
  action: string;
  tweetId: string;
  parentTweetId?: string;
  status: string;
  details: string;
  textContent?: string;
  mediaUrls?: string[];
  timestamp?: string;
}

/**
 * Extracts successful tweet actions from the short-term terminal history.
 * Supports both single and multiple commands per log entry.
 */
async function extractTweetActions(): Promise<TweetAction[]> {
  try {
    const messages = await getShortTermHistory(100);
    logger.info(`Retrieved ${messages.length} messages from short-term history`);
    
    const tweetActions: TweetAction[] = [];
    let currentSessionId: string | null = null;

    for (const message of messages) {
      if (message.role !== 'user' || !message.content) {
        continue;
      }

      // Extract timestamp from the log header
      const timestampMatch = message.content.match(/\[(\d{2}\/\d{2}\/\d{2} - \d{1,2}:\d{2} [AP]M [A-Z]+)\]/);
      const timestamp = timestampMatch ? timestampMatch[1] : null;

      // Split the content into individual command blocks
      // Each command block starts with a '$' symbol
      const commandBlocks = message.content
        .split(/\$(?=\s*[a-zA-Z-]+)/)
        .filter((block: string) => block.trim());

      // Process each command block separately
      for (const block of commandBlocks) {
        // Clean the command block
        const cleanBlock = block.trim();
        
        // Skip if not a tweet-related action
        if (!cleanBlock.includes('Tweet ID:') && !cleanBlock.includes('Reply Tweet ID:')) {
          continue;
        }

        // Split into lines and process
        const lines = cleanBlock.split('\n');

        // Extract action details
        const actionLine = lines.find((line: string) => line.includes('Action:'));
        const parentTweetIdLine = lines.find((line: string) => line.includes('Parent Tweet ID:'));
        const replyTweetIdLine = lines.find((line: string) => line.includes('Reply Tweet ID:'));
        const tweetIdLine = replyTweetIdLine || parentTweetIdLine;
        const statusLine = lines.find((line: string) => line.startsWith('Status:'));
        const detailsLine = lines.find((line: string) => line.startsWith('Details:'));
        const textLine = lines.find((line: string) => line.startsWith('Text:'));
        const mediaLine = lines.find((line: string) => line.startsWith('Media:'));

        // Only process if we have a tweet ID
        if (tweetIdLine) {
          const tweetId = tweetIdLine.split(':')[1].trim();
          
          if (tweetId) {
            tweetActions.push({
              sessionId: currentSessionId || 'unknown',
              role: message.role,
              action: actionLine ? actionLine.replace('Action:', '').replace('��', '').replace('ℹ️', '').trim() : '',
              tweetId,
              parentTweetId: parentTweetIdLine ? parentTweetIdLine.split(':')[1].trim() : undefined,
              status: statusLine ? statusLine.replace('Status:', '').trim() : '',
              details: detailsLine ? detailsLine.replace('Details:', '').trim() : '',
              textContent: textLine ? textLine.replace('Text:', '').trim() : undefined,
              mediaUrls: mediaLine && mediaLine !== 'Media: None'
                ? mediaLine.replace('Media:', '').trim().split(', ')
                : [],
              timestamp: timestamp || undefined
            });
          }
        }
      }
    }

    logger.info(`Extracted ${tweetActions.length} Tweet Actions`);
    return tweetActions;

  } catch (error) {
    logger.info('Error in extractTweetActions:', error);
    return [];
  }
}

/**
 * Gathers all unique user interactions based on tweet actions.
 * Groups interactions by user ID to facilitate learning extraction.
 */
export async function gatherUserInteractions(): Promise<Map<string, TwitterInteractionResult[]>> {
  // Extract tweet actions from the short-term history
  const tweetActions = await extractTweetActions();

  // Collect unique parent tweet IDs from the actions
  const uniqueTweetIds = new Set<string>();
  for (const action of tweetActions) {
    // Use parentTweetId for reply actions, otherwise use tweetId
    const relevantTweetId = action.parentTweetId || action.tweetId;
    uniqueTweetIds.add(relevantTweetId);
  }

  // Map to group interactions by user ID
  const userInteractionsMap = new Map<string, TwitterInteractionResult[]>();

  // Log the tweet IDs we're processing
  logger.info('Processing tweet IDs for interactions:', Array.from(uniqueTweetIds));

  // Iterate over each unique tweet ID
  for (const tweetId of uniqueTweetIds) {
    // Retrieve interaction summary and user ID for the tweet
    const interactionResult = await linkTwitterInteractions(tweetId);

    if (interactionResult) {
      const userId = interactionResult.userId;

      // Initialize array if user ID is encountered for the first time
      if (!userInteractionsMap.has(userId)) {
        userInteractionsMap.set(userId, []);
      }

      // Add the interaction to the user's array of interactions
      userInteractionsMap.get(userId)?.push(interactionResult);
    } else {
      logger.info(`No interaction found for tweet ID: ${tweetId}`);
    }
  }

  logger.info(`Processed interactions for ${userInteractionsMap.size} unique users`);
  return userInteractionsMap;
}

/**
 * Formats user interactions into a single comprehensive summary string
 * Returns a single string containing all user interactions
 */
export function formatUserInteractions(userInteractionsMap: Map<string, TwitterInteractionResult[]>): string {
  // Array to store formatted summaries that we'll join later
  const formattedSummaries: string[] = [];

  // Iterate through each user's interactions
  userInteractionsMap.forEach((interactions, userId) => {
    let userSummary = `[USER ID: ${userId}]\n\n`;

    // Add each interaction for this user as a numbered tweet
    interactions.forEach((interaction, index) => {
      userSummary += `[TWEET ${index + 1}]\n${interaction.formattedString}\n\n`;
    });

    formattedSummaries.push(userSummary);
  });

  // Join all summaries with double newlines between them
  return formattedSummaries.join('\n');
}

// Usage example:
export async function getFormattedInteractionSummary(): Promise<string> {
  const interactions = await gatherUserInteractions();
  return formatUserInteractions(interactions);
}

/**
 * Retrieves user IDs for an array of Twitter usernames from the database
 * @param usernames Array of Twitter usernames to look up
 * @returns Object mapping usernames to their user IDs (null if not found)
 */
export async function getUserIDsFromUsernames(
  usernames: string[]
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};

  // Fetch user IDs concurrently for efficiency
  await Promise.all(
      usernames.map(async (username) => {
          try {
              const result = await findTwitterUserByUsername(username);
              results[username] = result?.userId || null;
          } catch (error) {
              logger.info(`Error retrieving user ID for ${username}:`, error);
              results[username] = null;
          }
      })
  );

  return results;
}