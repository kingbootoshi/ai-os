// Simple CLI interface to accept user input

import readline from 'readline';
import { executeCommand } from '../terminal/executeCommand';
import { logger } from '../utils/logger';
import { registerCommands } from '../terminal/commandRegistry';
import { help } from '../terminal/commands/help';
import { Feature } from '../terminal/types/feature';
import InternetFeature from '../features/internet';
import TwitterFeature from '../features/twitter';
import NotesFeature from '../features/notes';
/**
 * Configuration for CLI test environment
 * Add or remove features as needed for testing
 */
const cliFeatures: Feature[] = [
  InternetFeature,
  TwitterFeature,
  NotesFeature,
  // Add other features here
];

interface CLIOptions {
  features?: Feature[];
}

/**
 * Initializes the CLI application for manual use to test terminal functions
 * - Sets up readline interface
 * - Registers core commands and feature commands
 * - Starts accepting commands
 * - Logs terminal history
 */
async function initializeCLI(options: CLIOptions = {}) {
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Register core commands
    registerCommands([help]);

    // Load and register feature commands
    if (options.features) {
      for (const feature of options.features) {
        const commands = await feature.loadFeatureCommands();
        registerCommands(commands);
      }
    }

    console.log('\nWelcome to the Terminal. Use "help" to view available commands. Type commands below:');

    rl.on('line', async (input) => {
      const trimmedInput = input.trim();
      if (trimmedInput) {
        try {
          // Execute the command and get raw result
          const result = await executeCommand(trimmedInput);
          
          // Log the raw output
          console.log(result.output);
        } catch (error) {
          console.error('Command execution failed:', error);
        }
      }
    });

    // Handle CLI shutdown
    rl.on('close', () => {
      console.log('\nGoodbye!');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to initialize CLI:', error);
    process.exit(1);
  }
}

// Start the CLI with configured features
initializeCLI({ features: cliFeatures });