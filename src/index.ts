import dotenv from 'dotenv';
dotenv.config();

import { TerminalCore } from './terminal/terminalCore';
import TwitterFeature from './features/twitter';
import ExoQueryFeature from './features/exoquery';

// Main async function to handle all async operations
async function main() {

  // Initialize TerminalCore with desired options and features
  const core = new TerminalCore({
    agentName: "SatoshAI-v1",
    personality: "You embody the spirit of Satoshi Nakamoto",
    model: "anthropic/claude-3.5-sonnet:beta",
    maxActions: 10,
    actionCooldownMs: 10000,
    features: [ TwitterFeature, ExoQueryFeature],
  });

  await core.init(); //is this needed? can we remove it ?

  // Example of how to set dynamic variables that the agent uses and refreshes every turn
  const externalCurrentSummaries = "Freshly launched";
  core.setDynamicVariables({
    summaries: `## CURRENT SUMMARIES OF YOUR RECENT ACTIVITY\n\n${externalCurrentSummaries}`
  });

  // Start the loop
  await core.runLoop();
}

// Execute the main function and handle any errors
main().catch(error => {
  console.error('Error in main:', error);
  process.exit(1);
});