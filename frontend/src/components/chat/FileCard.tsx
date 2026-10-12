'use client';

import React, { useState } from 'react';
import { Attachment } from '@/lib/types';
import {
  FileText,
  FileArchive,
  Image as ImageIcon,
  FileCode,
  Download,
  ExternalLink,
  HardDrive,
  Eye,
  X,
  Maximize2,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { CodeBlock } from './CodeBlock';

interface FileCardProps {
  attachment: Attachment;
}

export function FileCard({ attachment }: FileCardProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const ext = (attachment.fileName || '').split('.').pop()?.toLowerCase() || '';
  const isImage =
    ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp'].includes(ext) ||
    attachment.fileType?.startsWith('image/') ||
    attachment.mimeType?.startsWith('image/');

  const isCodeOrLog =
    ['log', 'json', 'sql', 'js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'sh', 'bash', 'yaml', 'yml', 'env', 'txt', 'md'].includes(ext) ||
    attachment.fileType?.includes('json') ||
    attachment.fileType?.includes('javascript') ||
    attachment.fileType?.includes('text');

  const isArchive = ['zip', 'tar', 'gz', 'rar', '7z'].includes(ext);

  // Secure download link routed through authorization verification
  const secureDownloadUrl = attachment.id
    ? `/api/files/${attachment.id}/download`
    : attachment.fileUrl || `/api/files/download-fallback?key=${encodeURIComponent(attachment.storageKey || attachment.fileName)}`;

  // Thumbnail / preview image URL
  const imageUrl = attachment.fileUrl?.startsWith('http')
    ? attachment.fileUrl
    : secureDownloadUrl;

  const handleOpenPreview = async () => {
    setIsPreviewOpen(true);
    if (previewContent === null) {
      setIsLoadingPreview(true);
      try {
        const res = await fetch(secureDownloadUrl);
        if (res.ok) {
          const text = await res.text();
          setPreviewContent(text);
        } else {
          setPreviewContent(`// Failed to load preview for ${attachment.fileName}\n// Status: ${res.statusText}`);
        }
      } catch {
        setPreviewContent(`// Preview generated for ${attachment.fileName}\n// Stored securely in Backblaze B2\n// Size: ${formatSize(attachment.fileSize)}`);
      } finally {
        setIsLoadingPreview(false);
      }
    }
  };

  const handleCopy = async () => {
    if (previewContent) {
      await navigator.clipboard.writeText(previewContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* 1. Image Attachment: Rich Thumbnail with Lightbox */}
      {isImage ? (
        <div className="my-2 max-w-sm rounded-2xl overflow-hidden border border-white/10 bg-[#0d1322] shadow-md group">
          <div
            onClick={() => setIsLightboxOpen(true)}
            className="relative cursor-pointer aspect-video bg-black/40 overflow-hidden flex items-center justify-center group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={attachment.fileName}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                // Fallback icon on broken image
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Hover overlay with expand button */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <span className="p-2 rounded-xl bg-white/20 text-white backdrop-blur-md hover:bg-white/30 transition-colors">
                <Maximize2 className="w-5 h-5" />
              </span>
            </div>

            {/* B2 Pill Tag */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 text-[10px] text-cyan-300 flex items-center gap-1 font-mono">
              <HardDrive className="w-2.5 h-2.5" />
              <span>B2</span>
            </div>
          </div>

          <div className="p-3 flex items-center justify-between gap-3 border-t border-white/5">
            <div className="min-w-0">
              <div className="text-xs font-medium text-white truncate">
                {attachment.fileName}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {formatSize(attachment.fileSize)}
              </div>
            </div>

            <a
              href={secureDownloadUrl}
              download={attachment.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              title="Download Image"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : (
        /* 2. Documents, Code, Logs, and Archives Card */
        <div className="my-2 p-3 rounded-2xl border border-white/10 bg-[#0d1322] hover:bg-[#11192e] transition-all flex items-center justify-between gap-3 max-w-md shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isCodeOrLog
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : isArchive
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
              }`}
            >
              {isCodeOrLog ? (
                <FileCode className="w-5 h-5" />
              ) : isArchive ? (
                <FileArchive className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                <span>{attachment.fileName}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                <span>{formatSize(attachment.fileSize)}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-[10px] text-cyan-400">
                  <HardDrive className="w-2.5 h-2.5" />
                  <span>Backblaze B2</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isCodeOrLog && (
              <button
                onClick={handleOpenPreview}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors"
                title="Quick Code/Log Preview"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </button>
            )}

            <a
              href={secureDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={attachment.fileName}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
              title="Secure Download from Backblaze B2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>
        </div>
      )}

      {/* 3. Image Lightbox Modal */}
      {isLightboxOpen && (
        <div
          onClick={() => setIsLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-[#0c101d] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-white truncate">
                  {attachment.fileName}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({formatSize(attachment.fileSize)})
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  Backblaze B2 Protected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={secureDownloadUrl}
                  download={attachment.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Image View */}
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={attachment.fileName}
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Code & Log Quick Preview Modal */}
      {isPreviewOpen && (
        <div
          onClick={() => setIsPreviewOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl max-h-[85vh] bg-[#0c101d] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-sm font-semibold text-white truncate">
                  {attachment.fileName}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({formatSize(attachment.fileSize)})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {previewContent && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}

                <a
                  href={secureDownloadUrl}
                  download={attachment.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>

                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {isLoadingPreview ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono">Streaming file from Backblaze B2...</span>
                </div>
              ) : (
                <CodeBlock
                  code={previewContent || '// Empty content'}
                  language={ext || 'typescript'}
                  filename={attachment.fileName}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
