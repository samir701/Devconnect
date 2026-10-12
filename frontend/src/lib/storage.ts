import {
  generateUploadUrl,
  generateDownloadUrl,
  deleteObjectFromB2,
  isB2Configured,
  getB2Client,
  getB2StorageStatus,
  buildStorageKey,
  saveLocalFallbackFile,
  readLocalFallbackFile,
} from './storage/b2';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export * from './storage/b2';

export interface StorageStatus {
  provider: 'BACKBLAZE_B2' | 'LOCAL_SERVERLESS_FALLBACK';
  connected: boolean;
  bucket: string;
  endpoint: string;
}

export function getStorageStatus(): StorageStatus {
  const b2Status = getB2StorageStatus();
  return {
    provider: b2Status.provider === 'BACKBLAZE_B2' ? 'BACKBLAZE_B2' : 'LOCAL_SERVERLESS_FALLBACK',
    connected: b2Status.connected,
    bucket: b2Status.bucket,
    endpoint: b2Status.endpoint,
  };
}

/**
 * Backwards-compatible wrapper around generateUploadUrl
 */
export async function getUploadPresignedUrl(key: string, contentType: string) {
  const result = await generateUploadUrl(key, contentType);
  const downloadUrl = await generateDownloadUrl(key);
  return {
    uploadUrl: result.uploadUrl,
    downloadUrl,
    storageKey: result.storageKey,
    isCloudB2: result.isCloudB2,
  };
}

/**
 * Upload buffer directly (e.g. server-side proxy route or fallback)
 */
export async function uploadToStorage(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const client = getB2Client();
  if (client && isB2Configured()) {
    const bucket = process.env.B2_BUCKET_NAME || 'zettadev-storage';
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return await getSignedUrl(client, getCommand, { expiresIn: 86400 * 7 });
  }

  // Save to local fallback storage
  saveLocalFallbackFile(key, buffer);
  return `/api/files/download-fallback?key=${encodeURIComponent(key)}`;
}
