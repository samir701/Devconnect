import { NextResponse } from 'next/server';
import { getDbStatus } from '@/lib/db';
import { getStorageStatus } from '@/lib/storage';

export async function GET() {
  const db = getDbStatus();
  const storage = getStorageStatus();

  return NextResponse.json({
    app: 'Devconnect / ZettaDev',
    version: '1.0.0',
    platform: 'Vercel Serverless',
    timestamp: new Date().toISOString(),
    database: {
      provider: 'TiDB Cloud (MySQL Serverless)',
      status: db.connected ? 'CONNECTED' : 'SERVERLESS_LOCAL_MODE',
      host: db.host,
      hasCredentials: !!(process.env.DATABASE_URL || process.env.TIDB_HOST),
    },
    storage: {
      provider: 'Backblaze B2 (S3-Compatible Object Storage)',
      status: storage.connected ? 'CONNECTED' : 'SERVERLESS_LOCAL_MODE',
      bucket: storage.bucket,
      endpoint: storage.endpoint,
      hasCredentials: !!(
        (process.env.B2_APPLICATION_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
        (process.env.B2_APPLICATION_KEY || process.env.AWS_SECRET_ACCESS_KEY)
      ),
    },
    realtime: {
      mode: 'Server-Sent Events / Event Stream (Vercel Serverless Compatible)',
      status: 'ACTIVE',
    },
    envGuide: {
      DATABASE_URL: 'mysql://user:pass@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/devconnect?ssl={"rejectUnauthorized":true}',
      B2_APPLICATION_KEY_ID: 'Your Backblaze B2 keyID',
      B2_APPLICATION_KEY: 'Your Backblaze B2 applicationKey',
      B2_BUCKET_NAME: 'zettadev-storage',
      B2_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
    },
  });
}
