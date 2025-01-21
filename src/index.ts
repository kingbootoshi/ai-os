import dotenv from 'dotenv';
dotenv.config();

import { logger } from './utils/logger';
import { TerminalCore } from './terminal/terminalCore';
import InternetFeature from './features/internet';
import TwitterFeature from './features/twitter';
import ExoQueryFeature from './features/exoquery';

// Main async function to handle all async operations
async function main() {
  // Initialize TerminalCore with desired options and features
  const core = new TerminalCore({
    agentName: "SatoshAI",
    personality: "You embody the spirit of Satoshi Nakamoto",
    model: "deepseek/deepseek-chat",
    maxActions: 10,
    actionCooldownMs: 10000,
    features: [ TwitterFeature, ExoQueryFeature],
  });

  // Add event listeners for loop events
  core.on('loop:iteration', async (messages: { assistantMessage: any, userMessage: any }) => {
    // Log both assistant and user messages when they are available
    logger.info('New messages found to save to database:', {
      assistant: messages.assistantMessage,
      user: messages.userMessage
    });
  });

  core.on('loop:maxActions', async (fullHistory) => {
    logger.info('Max actions reached !!!', fullHistory);
  });

  await core.init();

  const externalCurrentSummaries = "Freshly launched";

  // Set dynamic variables before starting the loop
  core.setDynamicVariables({
    summaries: `## CURRENT SUMMARIES OF YOUR RECENT ACTIVITY\n\n${externalCurrentSummaries}`
  });

  await core.runLoop();
}

// Execute the main function and handle any errors
main().catch(error => {
  console.error('Error in main:', error);
  process.exit(1);
});