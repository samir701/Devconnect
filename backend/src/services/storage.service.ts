import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const B2_KEY_ID = process.env.B2_APPLICATION_KEY_ID || process.env.B2_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const B2_APP_KEY = process.env.B2_APPLICATION_KEY || process.env.B2_APP_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const B2_BUCKET = process.env.B2_BUCKET_NAME || 'zettadev-storage';
const B2_ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
const B2_REGION = process.env.B2_REGION || 'us-east-005';

let s3Client: S3Client | null = null;

if (B2_KEY_ID && B2_APP_KEY) {
  try {
    s3Client = new S3Client({
      endpoint: B2_ENDPOINT,
      region: B2_REGION,
      credentials: {
        accessKeyId: B2_KEY_ID,
        secretAccessKey: B2_APP_KEY,
      },
      forcePathStyle: true,
    });
  } catch (err) {
    console.warn('[B2 Storage] Failed to initialize S3Client for Backblaze B2:', err);
  }
}

export interface StorageStatus {
  provider: 'BACKBLAZE_B2' | 'LOCAL_SERVERLESS_FALLBACK';
  connected: boolean;
  bucket: string;
  endpoint: string;
}

export function getStorageStatus(): StorageStatus {
  return {
    provider: s3Client ? 'BACKBLAZE_B2' : 'LOCAL_SERVERLESS_FALLBACK',
    connected: !!s3Client,
    bucket: B2_BUCKET,
    endpoint: B2_ENDPOINT,
  };
}

/**
 * Generate a pre-signed upload URL for client-side direct upload to Backblaze B2,
 * or returns a direct serverless upload endpoint if running without cloud credentials.
 */
export async function getUploadPresignedUrl(key: string, contentType: string): Promise<{ uploadUrl: string; downloadUrl: string; storageKey: string; isCloudB2: boolean }> {
  if (s3Client) {
    const command = new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const getCommand = new GetObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    });
    const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 86400 * 7 });
    return { uploadUrl, downloadUrl, storageKey: key, isCloudB2: true };
  }

  // Graceful fallback for local development or sandbox without live B2 keys:
  return {
    uploadUrl: `/api/files/upload-fallback?key=${encodeURIComponent(key)}`,
    downloadUrl: `/api/files/download-fallback?key=${encodeURIComponent(key)}`,
    storageKey: key,
    isCloudB2: false,
  };
}

/**
 * Upload buffer directly (e.g. server-side proxy route on Vercel)
 */
export async function uploadToStorage(key: string, buffer: Buffer, contentType: string): Promise<string> {
  if (s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    const getCommand = new GetObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    });
    return await getSignedUrl(s3Client, getCommand, { expiresIn: 86400 * 7 });
  }

  // Mock serverless data url fallback
  const base64 = buffer.toString('base64');
  return `data:${contentType};base64,${base64}`;
}
