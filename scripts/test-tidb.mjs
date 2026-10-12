import { connect } from '@tidbcloud/serverless';
import fs from 'fs';
import path from 'path';

// Load .env.local if present
function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const fullPath = path.resolve(envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          if (!process.env[key]) process.env[key] = value;
        }
      });
    }
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL;
const TIDB_HOST = process.env.TIDB_HOST;

console.log('----------------------------------------------------');
console.log('Testing TiDB Cloud Serverless Connection...');
console.log('----------------------------------------------------');

async function testConnection() {
  if (!DATABASE_URL && !TIDB_HOST) {
    console.log('ℹ️  No live TiDB credentials detected in .env.local');
    console.log('    Devconnect is operating in Resilient Serverless Local Mode.');
    console.log('    To connect to TiDB Cloud, add your DATABASE_URL in .env.local:');
    console.log('    DATABASE_URL="mysql://<user>:<pass>@<gateway>.tidbcloud.com:4000/devconnect?ssl={\\"rejectUnauthorized\\":true}"');
    process.exit(0);
  }

  try {
    const client = connect({ url: DATABASE_URL });
    const result = await client.execute('SELECT 1 as connected, VERSION() as version');
    console.log('✅ TiDB Cloud Connection Successful!');
    console.log('   Connected Status:', result.rows?.[0]?.connected ?? result[0]?.connected);
    console.log('   TiDB Server Version:', result.rows?.[0]?.version ?? result[0]?.version);
  } catch (err) {
    console.error('❌ Failed to connect to TiDB Cloud:');
    console.error(err.message);
    process.exit(1);
  }
}

testConnection();
