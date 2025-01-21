import { supabase } from '../../supabaseClient';
import { logger } from '../../../utils/logger';

export async function uploadAndLogMedia(
  mediaBuffer: Buffer,
  tweetId: string,
  mediaType: string
): Promise<string> {
  try {
    const extension = mediaType.split('/')[1] || 'bin';
    const mediaPath = `tweets/${tweetId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(mediaPath, mediaBuffer, {
        contentType: mediaType,
        upsert: true,
      });

    if (uploadError) {
      logger.error('Error uploading media to bucket:', uploadError);
      throw new Error(`Failed to upload media: ${uploadError.message}`);
    }

    const { data, error: dbError } = await supabase
      .from('media')
      .insert({
        file_path: mediaPath,
        media_type: mediaType,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (dbError) {
      logger.error('Error logging media to database:', dbError);
      throw new Error(`Failed to log media: ${dbError.message}`);
    }

    logger.info('Successfully uploaded and logged media:', data);
    return data.id;
  } catch (error) {
    logger.error('Exception in uploadAndLogMedia:', error);
    throw error;
  }
}