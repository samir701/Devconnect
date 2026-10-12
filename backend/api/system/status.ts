import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDbStatus } from '../../src/services/db.service';
import { getStorageStatus } from '../../src/services/storage.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getDbStatus();
  const storage = getStorageStatus();

  return res.status(200).json({
    app: 'Devconnect / ZettaDev Serverless Backend',
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
      mode: 'Server-Sent Events / Stream (Vercel Compatible)',
      status: 'ACTIVE',
    },
  });
}
