// Terminal logging utility

import { formatTimestamp } from "../utils/formatTimestamps";
/**
 * Logs terminal commands and their outputs.
 * @param command - The command that was executed.
 * @param output - The output of the command.
 * @param success - Whether the command executed successfully (default: true).
 */
export function logTerminalOutput(command: string, output: string, success: boolean = true) {
  const logEntry = {
    timestamp: formatTimestamp(new Date().toISOString()), // Now using ISO string
    command,
    output,
    success,
  };
}

// Export the formatter for use in other modules
export { formatTimestamp };