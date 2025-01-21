import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Database } from './types/database.types'; 
import { logger } from '../utils/logger';

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    logger.error('Error initializing Supabase client:', error.message);
    throw error;
  }
  logger.info('Supabase client initialized successfully');
});