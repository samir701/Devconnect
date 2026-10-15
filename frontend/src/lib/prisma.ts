import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Reset cached client if models were updated/regenerated
if (globalThis.__prisma && !('notification' in (globalThis.__prisma as unknown as Record<string, unknown>))) {
  globalThis.__prisma = undefined;
}

const DEFAULT_TIDB_URL =
  'mysql://2gbvCHB7bimYT2o.root:ZMVsFTMPh846aMiR@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/devconnect?sslaccept=strict';

function getDatasourceUrl(): string {
  const envUrl = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL;
  if (
    envUrl &&
    !envUrl.includes('username:password') &&
    !envUrl.includes('<USERNAME>') &&
    !envUrl.includes('<PASSWORD>') &&
    !envUrl.includes('YourPassword')
  ) {
    return envUrl;
  }
  return DEFAULT_TIDB_URL;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatasourceUrl(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export default prisma;
