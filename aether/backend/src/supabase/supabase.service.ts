import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase!: SupabaseClient;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // CRITICAL: Trim whitespace from env vars to prevent "Invalid Compact JWS" errors
    // This handles cases where .env files have trailing spaces or different line endings
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')?.trim();
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim();

    // Debug logging for JWT issue diagnosis (do not log full key for security)
    console.log('[SupabaseService] Initializing with:');
    console.log('  - SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET');
    console.log('  - SUPABASE_SERVICE_ROLE_KEY length:', supabaseServiceKey?.length ?? 'NOT SET');
    console.log('  - Key starts with "ey":', supabaseServiceKey?.startsWith('ey') ?? false);

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
        'Please check your backend/.env file and ensure both values are set correctly.'
      );
    }

    // Validate the key format - must be a valid JWT structure (3 parts separated by dots)
    const keyParts = supabaseServiceKey.split('.');
    if (keyParts.length !== 3) {
      throw new Error(
        `Invalid SUPABASE_SERVICE_ROLE_KEY format: expected 3 JWT parts, got ${keyParts.length}. ` +
        'The key should be in the format: header.payload.signature (each base64 encoded). ' +
        'Get the correct Service Role key from Supabase Dashboard > Project Settings > API.'
      );
    }

    if (!supabaseServiceKey.startsWith('ey')) {
      console.warn(
        '[SupabaseService] WARNING: SUPABASE_SERVICE_ROLE_KEY does not start with "ey" - ' +
        'this may not be a valid JWT! Check that you are using the Service Role key, not the anon key.'
      );
    }

    // Validate the URL format
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
      console.warn(
        '[SupabaseService] WARNING: SUPABASE_URL does not look like a valid Supabase URL. ' +
        `Expected format: https://your-project-ref.supabase.co, got: ${supabaseUrl}`
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the connection and bucket exist on startup
    await this.verifyStorageBucket('chat-uploads');
  }

  /**
   * Verify that a storage bucket exists and is accessible.
   * This helps catch configuration issues early on startup.
   */
  private async verifyStorageBucket(bucketName: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage.getBucket(bucketName);

      if (error) {
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          console.error(
            `[SupabaseService] ERROR: Storage bucket "${bucketName}" does not exist! ` +
            'Please create it in Supabase Dashboard > Storage > New Bucket.'
          );
        } else if (error.message.includes('Invalid Compact JWS') || error.message.includes('JWT')) {
          console.error(
            '[SupabaseService] ERROR: Invalid JWT when accessing storage. ' +
            'Your SUPABASE_SERVICE_ROLE_KEY is likely incorrect or has been rotated. ' +
            'Get the current Service Role key from Supabase Dashboard > Project Settings > API.'
          );
        } else {
          console.error(`[SupabaseService] ERROR: Failed to verify bucket "${bucketName}": ${error.message}`);
        }
        // Don't throw - allow the app to start but log the error
        return;
      }

      console.log(`[SupabaseService] ✓ Storage bucket "${bucketName}" verified successfully`);
    } catch (err) {
      console.error(`[SupabaseService] ERROR: Exception while verifying bucket: ${err}`);
    }
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

      // Provide specific, actionable error messages based on the error type
      if (error.message.includes('Invalid Compact JWS') || error.message.includes('JWT')) {
        throw new Error(
          `SUPABASE AUTH ERROR: ${error.message}. ` +
          'SOLUTION: Your SUPABASE_SERVICE_ROLE_KEY is invalid or has been rotated. ' +
          'Steps to fix: ' +
          '1) Go to Supabase Dashboard > Project Settings > API. ' +
          '2) Copy the "service_role" secret key (NOT the anon/public key). ' +
          '3) Update SUPABASE_SERVICE_ROLE_KEY in backend/.env. ' +
          '4) Restart the backend server.'
        );
      }

      if (error.message.includes('not found') || error.message.includes('Bucket not found')) {
        throw new Error(
          `SUPABASE BUCKET ERROR: Bucket "${bucket}" does not exist. ` +
          'SOLUTION: Create the bucket in Supabase Dashboard > Storage > New Bucket. ' +
          `Name it exactly: "${bucket}". You can set it as private for security.`
        );
      }

      if (error.message.includes('not authorized') || error.message.includes('permission')) {
        throw new Error(
          `SUPABASE PERMISSION ERROR: ${error.message}. ` +
          'SOLUTION: Ensure you are using the Service Role key (not the anon key) ' +
          'and that the bucket has the correct RLS policies configured.'
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
