import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase!: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    // Debug logging for JWT issue diagnosis (do not log full key for security)
    console.log('[SupabaseService] Initializing with:');
    console.log('  - SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET');
    console.log('  - SUPABASE_SERVICE_ROLE_KEY length:', supabaseServiceKey?.length ?? 'NOT SET');
    console.log('  - Key starts with "ey":', supabaseServiceKey?.startsWith('ey') ?? false);

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    // Validate the key format
    if (!supabaseServiceKey.startsWith('ey')) {
      console.warn('[SupabaseService] WARNING: SUPABASE_SERVICE_ROLE_KEY does not start with "ey" - this may not be a valid JWT!');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Generate a signed upload URL for a file.
   * This allows authenticated users to upload directly to Supabase Storage
   * without needing Supabase auth.
   */
  async createSignedUploadUrl(
    bucket: string,
    filePath: string,
  ): Promise<{
    signedUrl: string;
    token: string;
    path: string;
  }> {
    console.log(`[SupabaseService] Creating signed upload URL for bucket: ${bucket}, path: ${filePath}`);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('[SupabaseService] Failed to create signed upload URL:', {
        bucket,
        filePath,
        errorMessage: error.message,
        errorName: error.name,
      });

      // Check for common JWT-related errors
      if (error.message.includes('Invalid Compact JWS') || error.message.includes('JWT')) {
        throw new Error(
          `Failed to create signed upload URL: ${error.message}. ` +
          'This usually indicates an invalid SUPABASE_SERVICE_ROLE_KEY. ' +
          'Please verify the key in your .env file matches the Service Role key from Supabase Dashboard > Project Settings > API.'
        );
      }

      throw new Error(`Failed to create signed upload URL: ${error.message}`);
    }

    console.log('[SupabaseService] Successfully created signed upload URL');
    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    };
  }

  /**
   * Get the public URL for a file in storage.
   */
  getPublicUrl(bucket: string, filePath: string): string {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  /**
   * Get the Supabase client for other operations.
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }
}
