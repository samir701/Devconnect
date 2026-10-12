import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

// Environment credentials & configuration helpers
function isPlaceholder(val?: string): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  return (
    trimmed === '' ||
    trimmed.includes('<') ||
    trimmed.includes('>') ||
    trimmed.includes('YOUR_B2') ||
    trimmed === 'undefined' ||
    trimmed.length < 20 // Backblaze B2 Application Key IDs are 25 hex characters, secret keys are 31-42 chars
  );
}

// Dynamic configuration getter that checks process.env and parent .env
export function getB2Config() {
  let keyId =
    process.env.B2_KEY_ID ||
    process.env.B2_APPLICATION_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID;

  let appKey =
    process.env.B2_APPLICATION_KEY ||
    process.env.B2_APP_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY;

  let bucket = process.env.B2_BUCKET_NAME;
  let endpointRaw = process.env.B2_ENDPOINT;
  let region = process.env.B2_REGION;

  bucket = bucket || 'zettadev-storage';
  endpointRaw = endpointRaw || 'https://s3.us-east-005.backblazeb2.com';
  region = region || 'us-east-005';

  const endpoint =
    endpointRaw.startsWith('http://') || endpointRaw.startsWith('https://')
      ? endpointRaw
      : `https://${endpointRaw}`;

  const configured = !isPlaceholder(keyId) && !isPlaceholder(appKey);

  return {
    keyId: keyId?.trim(),
    appKey: appKey?.trim(),
    bucket: bucket.trim(),
    endpoint,
    region: region.trim(),
    isConfigured: configured,
  };
}

let s3ClientInstance: S3Client | null = null;
let lastKeyId: string | undefined = undefined;
let lastAppKey: string | undefined = undefined;
let lastEndpoint: string | undefined = undefined;

/**
 * Returns true if valid Backblaze B2 credentials are configured
 */
export function isB2Configured(): boolean {
  return getB2Config().isConfigured;
}

export function getB2Client(): S3Client | null {
  const config = getB2Config();
  if (!config.isConfigured) return null;

  if (
    s3ClientInstance &&
    lastKeyId === config.keyId &&
    lastAppKey === config.appKey &&
    lastEndpoint === config.endpoint
  ) {
    return s3ClientInstance;
  }

  try {
    s3ClientInstance = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.keyId!,
        secretAccessKey: config.appKey!,
      },
      forcePathStyle: true,
    });
    lastKeyId = config.keyId;
    lastAppKey = config.appKey;
    lastEndpoint = config.endpoint;
    return s3ClientInstance;
  } catch (err) {
    console.warn('[Backblaze B2] Failed to initialize S3Client:', err);
    return null;
  }
}

export interface B2StorageStatus {
  provider: 'BACKBLAZE_B2' | 'LOCAL_DEV_FALLBACK';
  connected: boolean;
  bucket: string;
  endpoint: string;
  region: string;
}

export function getB2StorageStatus(): B2StorageStatus {
  const config = getB2Config();
  const client = getB2Client();
  return {
    provider: config.isConfigured && client ? 'BACKBLAZE_B2' : 'LOCAL_DEV_FALLBACK',
    connected: config.isConfigured && !!client,
    bucket: config.bucket,
    endpoint: config.endpoint,
    region: config.region,
  };
}

/**
 * Suggested B2 Bucket Key generator:
 * - Project files: `zettadev/project-files/{projectId}/{timestamp}_{filename}`
 * - Conversation attachments: `zettadev/attachments/{conversationId}/{timestamp}_{filename}`
 * - User avatars: `zettadev/avatars/{userId}/{timestamp}_{filename}`
 */
export function buildStorageKey(
  type: 'project' | 'conversation' | 'avatar',
  entityId: string,
  fileName: string
): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  switch (type) {
    case 'project':
      return `zettadev/project-files/${entityId}/${timestamp}_${sanitized}`;
    case 'conversation':
      return `zettadev/attachments/${entityId}/${timestamp}_${sanitized}`;
    case 'avatar':
      return `zettadev/avatars/${entityId}/${timestamp}_${sanitized}`;
    default:
      return `zettadev/project-files/${entityId}/${timestamp}_${sanitized}`;
  }
}

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  isCloudB2: boolean;
  bucket: string;
  expiresIn: number;
  headers?: Record<string, string>;
}

/**
 * Generate a pre-signed PUT URL for direct-to-B2 client upload.
 * If B2 credentials are unset, returns a server-side upload endpoint for local development.
 */
export async function generateUploadUrl(
  key: string,
  contentType: string = 'application/octet-stream',
  expiresIn: number = 3600
): Promise<PresignedUploadResult> {
  const client = getB2Client();
  const config = getB2Config();

  if (client && config.isConfigured) {
    try {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(client, command, { expiresIn });
      return {
        uploadUrl,
        storageKey: key,
        isCloudB2: true,
        bucket: config.bucket,
        expiresIn,
        headers: {
          'Content-Type': contentType,
        },
      };
    } catch (err) {
      console.warn('[Backblaze B2] Failed to generate presigned upload URL, falling back:', err);
    }
  }

  // Graceful Local Fallback:
  return {
    uploadUrl: `/api/files/upload?storageKey=${encodeURIComponent(key)}`,
    storageKey: key,
    isCloudB2: false,
    bucket: 'local-dev-storage',
    expiresIn,
  };
}

/**
 * Generate a pre-signed GET URL for secure, time-limited download.
 * Sets `response-content-disposition` so the browser triggers a download with the original filename.
 */
export async function generateDownloadUrl(
  key: string,
  originalFileName?: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getB2Client();
  const config = getB2Config();

  if (client && config.isConfigured) {
    try {
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ResponseContentDisposition: originalFileName
          ? `attachment; filename="${encodeURIComponent(originalFileName)}"`
          : 'attachment',
      });

      return await getSignedUrl(client, command, { expiresIn });
    } catch (err) {
      console.warn('[Backblaze B2] Failed to generate presigned download URL, falling back:', err);
    }
  }

  // Graceful Local Fallback:
  const query = new URLSearchParams({ key });
  if (originalFileName) {
    query.set('fileName', originalFileName);
  }
  return `/api/files/download-fallback?${query.toString()}`;
}

/**
 * Removes an object from Backblaze B2 (or local fallback storage).
 */
export async function deleteObjectFromB2(key: string): Promise<boolean> {
  const client = getB2Client();
  const config = getB2Config();

  if (client && config.isConfigured) {
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        })
      );
      return true;
    } catch (err) {
      console.error('[Backblaze B2] Failed to delete object:', err);
      return false;
    }
  }

  // Local storage cleanup if fallback file exists
  try {
    const localPath = getLocalFilePath(key);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Check if an object exists in B2
 */
export async function checkObjectExists(key: string): Promise<boolean> {
  const client = getB2Client();
  const config = getB2Config();
  if (client && config.isConfigured) {
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  const localPath = getLocalFilePath(key);
  return fs.existsSync(localPath);
}

// ================= LOCAL FALLBACK STORAGE HELPERS =================
const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), '.local-storage');

export function getLocalFilePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(LOCAL_STORAGE_DIR, safeKey);
}

export function saveLocalFallbackFile(key: string, buffer: Buffer): void {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
  const filePath = getLocalFilePath(key);
  fs.writeFileSync(filePath, buffer);
}

export function readLocalFallbackFile(key: string): Buffer | null {
  const filePath = getLocalFilePath(key);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return null;
}
