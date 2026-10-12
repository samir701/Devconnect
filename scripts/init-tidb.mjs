import { connect } from '@tidbcloud/serverless';
import fs from 'fs';
import path from 'path';

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

console.log('----------------------------------------------------');
console.log('Initializing TiDB Cloud Schema (schema.sql)...');
console.log('----------------------------------------------------');

async function initSchema() {
  if (!DATABASE_URL) {
    console.log('ℹ️  No DATABASE_URL found in .env.local.');
    console.log('    Please set DATABASE_URL in .env.local to run migration on TiDB Cloud.');
    process.exit(1);
  }

  try {
    const schemaPath = path.resolve('backend/sql/schema.sql');
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');

    const statements = sqlContent
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    const client = connect({ url: DATABASE_URL });

    console.log(`Executing ${statements.length} DDL statements on TiDB Cloud...`);
    for (const stmt of statements) {
      await client.execute(stmt);
    }

    console.log('✅ TiDB Cloud Database Schema initialized successfully!');
  } catch (err) {
    console.error('❌ Error executing schema on TiDB Cloud:');
    console.error(err.message);
    process.exit(1);
  }
}

initSchema();
