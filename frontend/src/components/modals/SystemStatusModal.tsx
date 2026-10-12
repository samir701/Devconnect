'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Database,
  HardDrive,
  Cpu,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Copy,
  Check,
  Server,
  Zap,
} from 'lucide-react';

export function SystemStatusModal() {
  const { isStatusOpen, setIsStatusOpen } = useAppStore();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  useEffect(() => {
    if (isStatusOpen) {
      setLoading(true);
      fetch('/api/system/status')
        .then((res) => res.json())
        .then((data) => setStatus(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isStatusOpen]);

  if (!isStatusOpen) return null;

  const copyEnvSample = () => {
    const envText = `# Devconnect / ZettaDev - Vercel Serverless Environment Configuration
DATABASE_URL="mysql://<user>:<password>@<gateway>.tidbcloud.com:4000/devconnect?ssl={\\"rejectUnauthorized\\":true}"
TIDB_HOST="<gateway>.tidbcloud.com"
TIDB_USER="<user>"
TIDB_PASSWORD="<password>"
TIDB_DATABASE="devconnect"

# Backblaze B2 Object Storage (S3-Compatible)
B2_APPLICATION_KEY_ID="<your-b2-key-id>"
B2_APPLICATION_KEY="<your-b2-application-key>"
B2_BUCKET_NAME="zettadev-storage"
B2_ENDPOINT="https://s3.us-east-005.backblazeb2.com"
B2_REGION="us-east-005"
`;
    navigator.clipboard.writeText(envText);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0e1320] shadow-2xl p-6 relative">
        <button
          onClick={() => setIsStatusOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Cloud Infrastructure Diagnostics
            </h3>
            <p className="text-xs text-slate-400">
              Vercel Serverless runtime with TiDB Cloud & Backblaze B2 S3 storage
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* TiDB Card */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    Database: TiDB Cloud Serverless
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.2 rounded border border-emerald-800/40 font-mono">
                    {status?.database?.status === 'CONNECTED' ? 'Live Cloud' : 'Serverless Ready'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  MySQL 8.0 protocol via @tidbcloud/serverless HTTP driver for stateless edge execution.
                </p>
                <div className="text-[10px] font-mono text-indigo-300 mt-1">
                  Host: {status?.database?.host || 'Local Serverless Engine'}
                </div>
              </div>
            </div>
          </div>

          {/* Backblaze B2 Card */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    File Storage: Backblaze B2
                  </span>
                  <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-2 py-0.2 rounded border border-cyan-800/40 font-mono">
                    {status?.storage?.status === 'CONNECTED' ? 'Live B2 S3' : 'Serverless Ready'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  S3-compatible presigned uploads and secure bucket storage for developer artifacts.
                </p>
                <div className="text-[10px] font-mono text-cyan-300 mt-1">
                  Bucket: {status?.storage?.bucket || 'zettadev-storage'}
                </div>
              </div>
            </div>
          </div>

          {/* Vercel Serverless Architecture Card */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    Compute: Vercel Serverless Functions
                  </span>
                  <span className="text-[10px] text-purple-400 bg-purple-950/40 px-2 py-0.2 rounded border border-purple-800/40 font-mono">
                    Zero Persistent Daemons
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Stateless App Router API routes (`/api/...`) with Server-Sent Events (SSE) realtime stream.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Env Setup */}
        <div className="mt-5 p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
          <div className="text-xs text-slate-300">
            Deploying to Vercel? Copy template <code className="text-indigo-300 font-mono">.env.local</code>:
          </div>
          <button
            onClick={copyEnvSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white border border-white/10 transition-colors"
          >
            {copiedEnv ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy .env</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={() => setIsStatusOpen(false)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
