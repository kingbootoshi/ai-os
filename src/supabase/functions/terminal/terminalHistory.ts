import { logger } from '../../../utils/logger';
import { supabase } from '../../supabaseClient';

// COME BACK TO THIS SET IT UP WHEN YOU HAVE TERMINAL AGENT CONFIG SET UP
interface Message {
  role: 'system' | 'assistant' | 'user' | 'function';
  content?: string;
  name?: string;
  image?: {
    name: string;
    mime: string;
    data: Buffer | string;
  };
  runData?: any;
}

type ValidRole = 'user' | 'assistant' | 'system';

export async function storeTerminalMessage(
  message: Message,
  sessionId: string
): Promise<void> {
  try {
    if (message.role === 'function') {
      logger.info('Skipping function message, not storing in history');
      return;
    }

    const { error } = await supabase
      .from('short_term_terminal_history')
      .insert({
        role: message.role as ValidRole,
        content: message.content || '',
        session_id: sessionId
      });

    if (error) {
      logger.error('Error storing terminal message:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Failed to store terminal message:', error);
    throw error;
  }
}

export async function getShortTermHistory(limit: number = 10): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('short_term_terminal_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error loading short term history:', error);
      throw error;
    }

    return data
      .map(entry => ({
        role: entry.role as Message['role'],
        content: entry.content
      }))
      .reverse();
  } catch (error) {
    logger.error('Failed to load short term history:', error);
    throw error;
  }
}

export async function clearShortTermHistory(): Promise<void> {
  try {
    const { error } = await supabase
      .from('short_term_terminal_history')
      .delete()
      .gte('id', 0);

    if (error) {
      logger.error('Error clearing short term history:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Failed to clear short term history:', error);
    throw error;
  }
}

export async function getFormattedRecentHistory(limit: number = 6): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('short_term_terminal_history')
      .select('*')
      .order('created_at', { ascending: false }) 
      .limit(limit);

    if (error) {
      logger.error('Error loading recent history:', error);
      throw error;
    }

    const recentHistory = data.reverse();

    return recentHistory
      .map((entry, index) => {
        const separator = index === 0 ? '' : '\n-------------------\n';
        const roleLabel = entry.role === 'assistant' ? '[YOU]' : 
                          entry.role === 'user' ? '[TERMINAL]' : 
                          `[${entry.role.toUpperCase()}]`;
        return `${separator}${roleLabel}:\n${entry.content}`;
      })
      .join('');
  } catch (error) {
    logger.error('Failed to load formatted recent history:', error);
    throw error;
  }
}