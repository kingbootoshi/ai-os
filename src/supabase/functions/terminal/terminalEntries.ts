import { supabase } from '../../supabaseClient';
import { z } from 'zod';
import { logger } from '../../../utils/logger';

const terminalCommandSchema = z.object({
  command: z.string()
});

const terminalToolSchema = z.object({
  internal_thought: z.string(),
  plan: z.string(),
  terminal_commands: z.array(terminalCommandSchema)
});

type TerminalToolOutput = z.infer<typeof terminalToolSchema>;

/**
 * Creates a new terminal_history entry from the agent's internal thought/plan + a list of commands.
 * This is typically invoked by some tool or pipeline that tracks multiple commands in one go.
 */
export async function createTerminalEntry(
  sessionId: string,
  output: TerminalToolOutput
) {
  try {
    const commandsString = output.terminal_commands
      .map((cmd: { command: string }) => cmd.command)
      .join('\n');

    const { data: entry, error } = await supabase
      .from('terminal_history')
      .insert({
        session_id: sessionId,
        internal_thought: output.internal_thought,
        plan: output.plan,
        command: commandsString,
        terminal_log: null
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error creating terminal entry:', error);
      return null;
    }

    return entry?.id;
  } catch (error) {
    logger.error('Error creating terminal entry:', error);
    return null;
  }
}

/**
 * Updates an existing terminal_history record to include the final output from the terminal.
 * Used when you have a partial record inserted, but need to store the console/log output later.
 */
export async function updateTerminalResponse(
  entryId: number,
  response: string
) {
  try {
    const { data, error } = await supabase
      .from('terminal_history')
      .update({ terminal_log: response })
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating terminal response:', error);
      return null;
    }

    return data?.id;
  } catch (error) {
    logger.error('Error updating terminal response:', error);
    return null;
  }
}

/**
 * Sets the active/inactive state in the terminal_status table.
 */
export async function updateTerminalStatus(isActive: boolean) {
  try {
    const { data, error } = await supabase
      .from('terminal_status')
      .update({ 
        is_active: isActive,
        last_updated: new Date().toISOString()
      })
      .eq('id', true)
      .select()
      .single();

    if (error) {
      logger.error('Error updating terminal status:', error);
      return null;
    }

    return data?.is_active;
  } catch (error) {
    logger.error('Error updating terminal status:', error);
    return null;
  }
}

/**
 * Retrieves the current is_active and last_updated from the terminal_status table.
 */
export async function getTerminalStatus() {
  try {
    const { data, error } = await supabase
      .from('terminal_status')
      .select('is_active, last_updated')
      .eq('id', true)
      .single();

    if (error) {
      logger.error('Error getting terminal status:', error);
      return null;
    }

    return data;
  } catch (error) {
    logger.error('Error getting terminal status:', error);
    return null;
  }
}

/**
 * Store a single message (assistant or user) in the terminal_history table in a simplified format.
 * This ensures we also keep a long-term record of messages in parallel to short_term_terminal_history.
 */
export async function storeFullMessage(
  sessionId: string,
  role: 'assistant' | 'user',
  content: string
) {
  try {
    // We'll treat the 'command' field as the role and 'terminal_log' as the message content
    const { error } = await supabase
      .from('terminal_history')
      .insert({
        session_id: sessionId,
        command: role,            // store the role in the command field
        terminal_log: content,    // store the message text in terminal_log
        internal_thought: null,
        plan: null
      });

    if (error) {
      logger.error('Error storing full message in terminal_history:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Failed to store full message in terminal_history:', error);
  }
}