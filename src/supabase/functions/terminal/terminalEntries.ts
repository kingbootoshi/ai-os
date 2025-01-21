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

export async function createTerminalEntry(
  sessionId: string,
  output: TerminalToolOutput
) {
  try {
    const commandsString = output.terminal_commands
      .map((cmd: { command: string }) => cmd.command)
      .join('\n');

    const { data: entry } = await supabase
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

    return entry?.id;
  } catch (error) {
    logger.error('Error creating terminal entry:', error);
    return null;
  }
}

export async function updateTerminalResponse(
  entryId: number,
  response: string
) {
  try {
    const { data } = await supabase
      .from('terminal_history')
      .update({ terminal_log: response })
      .eq('id', entryId)
      .select()
      .single();

    return data?.id;
  } catch (error) {
    logger.error('Error updating terminal response:', error);
    return null;
  }
}

export async function updateTerminalStatus(isActive: boolean) {
  try {
    const { data } = await supabase
      .from('terminal_status')
      .update({ 
        is_active: isActive,
        last_updated: new Date().toISOString()
      })
      .eq('id', true)
      .select()
      .single();

    return data?.is_active;
  } catch (error) {
    logger.error('Error updating terminal status:', error);
    return null;
  }
}

export async function getTerminalStatus() {
  try {
    const { data } = await supabase
      .from('terminal_status')
      .select('is_active, last_updated')
      .eq('id', true)
      .single();

    return data;
  } catch (error) {
    logger.error('Error getting terminal status:', error);
    return null;
  }
}