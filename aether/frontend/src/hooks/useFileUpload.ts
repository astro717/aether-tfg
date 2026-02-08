import { useState, useCallback } from 'react';
import { messagingApi } from '../modules/messaging/api/messagingApi';

export interface UploadedFile {
  filePath: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface FileUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

/**
 * Hook for uploading files using signed URLs from the backend.
 * This bypasses Supabase RLS by having the backend generate signed upload URLs.
 */
export function useFileUpload(_folderPath: string = 'messages') {
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  });

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      setState({ isUploading: true, progress: 0, error: null });

      try {
        // Step 1: Get signed upload URL from backend
        const { uploadUrl, publicUrl, filePath } = await messagingApi.getUploadUrl(
          file.name,
          file.type
        );

        // Step 2: Upload file directly to Supabase using the signed URL
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        setState({ isUploading: false, progress: 100, error: null });

        return {
          filePath,
          fileUrl: publicUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setState({ isUploading: false, progress: 0, error: errorMessage });
        console.error('File upload error:', err);
        return null;
      }
    },
    []
  );

  const uploadFiles = useCallback(
    async (files: File[]): Promise<UploadedFile[]> => {
      setState({ isUploading: true, progress: 0, error: null });

      const uploaded: UploadedFile[] = [];
      const total = files.length;

      for (let i = 0; i < files.length; i++) {
        const result = await uploadFile(files[i]);
        if (result) {
          uploaded.push(result);
        }
        setState((prev) => ({
          ...prev,
          progress: Math.round(((i + 1) / total) * 100),
        }));
      }

      setState({ isUploading: false, progress: 100, error: null });
      return uploaded;
    },
    [uploadFile]
  );

  const resetState = useCallback(() => {
    setState({ isUploading: false, progress: 0, error: null });
  }, []);

  return {
    ...state,
    uploadFile,
    uploadFiles,
    resetState,
  };
}
