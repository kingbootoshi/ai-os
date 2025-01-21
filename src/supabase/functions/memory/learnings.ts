import { supabase } from '../../supabaseClient';
import { logger } from '../../../utils/logger';
// import { configLoader } from '../../../utils/config';
//COME BACK TO THIS SET IT UP WHEN YOU HAVE TERMINAL AGENT CONFIG SET UP

const agentName = "test"
const selfFieldName = `${agentName}_self` as const;

type LearningType = 'world_knowledge' | 'crypto_ecosystem_knowledge' | 'user_specific' | typeof selfFieldName;

interface LearningEntry {
  id: number;
  session_id: string | null;
  user_id: string | null;
  learning_type: LearningType;
  content: string;
  created_at?: string;
}

export class Learnings {
  static async saveLearning(
    learningType: LearningType,
    content: string,
    sessionId: string | null,
    userId: string | null = null
  ): Promise<void> {
    try {
      await supabase
        .from('learnings')
        .insert({
          learning_type: learningType,
          content,
          session_id: sessionId,
          user_id: userId,
        });
      logger.info(`Successfully saved learning of type: ${learningType}`);
    } catch (error) {
      logger.error('Error saving learning:', error);
    }
  }

  static async getLearningsByType(
    learningType: LearningType,
    sessionId: string | null = null
  ): Promise<LearningEntry[]> {
    try {
      let query = supabase
        .from('learnings')
        .select('*')
        .eq('learning_type', learningType);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error retrieving learnings:', error);
        return [];
      }

      return data as LearningEntry[];
    } catch (error) {
      logger.error('Error retrieving learnings:', error);
      return [];
    }
  }
}