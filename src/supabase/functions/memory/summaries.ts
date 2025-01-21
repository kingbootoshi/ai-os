import { supabase } from '../../supabaseClient';
import { logger } from '../../../utils/logger';
import { formatTimestamp } from '../../../utils/formatTimestamps';

interface MemorySummary {
  id: number;
  summary_type: 'short' | 'mid' | 'long';
  summary: string;
  processed: boolean;
  session_id: string | null;
  created_at?: string;
  last_updated?: string;
}

export class MemorySummaries {
  static async saveSummary(
    summaryType: 'short' | 'mid' | 'long',
    summary: string,
    sessionId: string | null
  ): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('memory_summaries')
        .insert({
          summary_type: summaryType,
          summary,
          session_id: sessionId,
          processed: false
        })
        .select();

      if (error) {
        logger.error(`Error saving ${summaryType}-term summary:`, error);
      } else {
        logger.info(`${summaryType}-term summary saved successfully.`, data);
      }
    } catch (error) {
      logger.error(`Exception in saveSummary when saving ${summaryType}-term summary:`, error);
    }
  }

  static async markSummariesAsProcessed(summaryIds: number[]): Promise<void> {
    try {
      await supabase
        .from('memory_summaries')
        .update({ processed: true })
        .in('id', summaryIds);
    } catch (error) {
      logger.error('Error marking summaries as processed:', error);
    }
  }

  static async updateLongTermSummary(summary: string): Promise<void> {
    try {
      const { data: currentLongTerm } = await supabase
        .from('memory_summaries')
        .select('*')
        .eq('summary_type', 'long')
        .eq('processed', false)
        .single();

      if (currentLongTerm) {
        await supabase
          .from('memory_summaries')
          .update({ processed: true })
          .eq('id', currentLongTerm.id);
      }

      await supabase
        .from('memory_summaries')
        .insert({
          summary_type: 'long',
          summary,
          session_id: null,
          processed: false
        });
    } catch (error) {
      logger.error('Error updating long-term summary:', error);
    }
  }

  static async getActiveMemories(): Promise<{
    short: MemorySummary[];
    mid: MemorySummary[];
    long: MemorySummary | null;
  }> {
    try {
      const { data: shortTerm = [] } = await supabase
        .from('memory_summaries')
        .select('*')
        .eq('summary_type', 'short')
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: midTerm = [] } = await supabase
        .from('memory_summaries')
        .select('*')
        .eq('summary_type', 'mid')
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(2);

      const { data: longTerm } = await supabase
        .from('memory_summaries')
        .select('*')
        .eq('summary_type', 'long')
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        short: shortTerm as MemorySummary[],
        mid: midTerm as MemorySummary[],
        long: longTerm as MemorySummary
      };
    } catch (error) {
      logger.error('Error getting active memories:', error);
      return {
        short: [],
        mid: [],
        long: null
      };
    }
  }

  static async checkAndProcessShortTermSummaries(): Promise<boolean> {
    try {
      const shortTerms = await this.getUnprocessedSummaries('short', 6);
      return shortTerms.length >= 6;
    } catch (error) {
      logger.error('Error checking short-term summaries:', error);
      return false;
    }
  }

  static async checkAndProcessMidTermSummaries(): Promise<boolean> {
    try {
      const midTerms = await this.getUnprocessedSummaries('mid', 3);
      return midTerms.length >= 3;
    } catch (error) {
      logger.error('Error checking mid-term summaries:', error);
      return false;
    }
  }

  static async getUnprocessedSummaries(
    summaryType: 'short' | 'mid' | 'long',
    limit: number
  ): Promise<MemorySummary[]> {
    try {
      const { data } = await supabase
        .from('memory_summaries')
        .select('*')
        .eq('summary_type', summaryType)
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(limit);

      return (data || []) as MemorySummary[];
    } catch (error) {
      logger.error('Error getting unprocessed summaries:', error);
      return [];
    }
  }

  static async getFormattedActiveSummaries(): Promise<string> {
    try {
      const activeMemories = await this.getActiveMemories();

      const formattedSummaries: string[] = [];

      const formatSupabaseTimestamp = (timestamp: string | null | undefined): string => {
        try {
          if (!timestamp) return 'No timestamp';
          const cleanTimestamp = timestamp.split('+')[0] + 'Z';
          return formatTimestamp(new Date(cleanTimestamp));
        } catch (err) {
          logger.error('Error formatting timestamp:', err);
          return 'Invalid timestamp';
        }
      };

      if (activeMemories.long) {
        const timestamp = formatSupabaseTimestamp(activeMemories.long.created_at);
        formattedSummaries.push(
          `### LONG TERM SUMMARY\n[${timestamp}]\n${activeMemories.long.summary}\n`
        );
      }

      if (activeMemories.mid.length > 0) {
        formattedSummaries.push('### MID-TERM SUMMARIES');
        activeMemories.mid
          .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime())
          .forEach(summary => {
            const timestamp = formatSupabaseTimestamp(summary.created_at);
            formattedSummaries.push(`[${timestamp}]\n${summary.summary}\n`);
          });
      }

      if (activeMemories.short.length > 0) {
        formattedSummaries.push('### SHORT-TERM SUMMARIES');
        activeMemories.short
          .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime())
          .forEach(summary => {
            const timestamp = formatSupabaseTimestamp(summary.created_at);
            formattedSummaries.push(`[${timestamp}]\n${summary.summary}\n`);
          });
      }

      const result = formattedSummaries.join('\n');

      return result || 'No active summaries found.';
    } catch (error) {
      logger.error('Error getting formatted active summaries:', error);
      return 'Error retrieving summaries.';
    }
  }
}