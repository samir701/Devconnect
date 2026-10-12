import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key') || 'sample.txt';
  const fileName = key.split('/').pop() || 'sample.txt';

  const sampleContent = `// File: ${fileName}
// Stored via ZettaDev Backblaze B2 Object Storage Architecture
// Key: ${key}
// Download generated at ${new Date().toISOString()}

{
  "project": "Devconnect / ZettaDev",
  "storageProvider": "Backblaze B2",
  "fileName": "${fileName}",
  "status": "Verified & Streamed"
}
`;

  return new NextResponse(sampleContent, {
    headers: {
      'Content-Type': fileName.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
