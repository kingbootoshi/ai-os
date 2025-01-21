// Core terminal commands collection

import { Command } from '../types/commands';
import { help } from './help';

// Import other command modules here
// import { someCommand } from './someCommand';

/**
 * Collection of core terminal commands
 */
export const coreCommands: Command[] = [
  help,
  // Add other commands here
];

/**
 * Loads and returns all core terminal commands
 */
export function loadCoreCommands(): Command[] {
  return coreCommands;
} 