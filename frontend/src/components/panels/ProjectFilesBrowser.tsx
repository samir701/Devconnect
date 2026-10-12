'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Attachment } from '@/lib/types';
import {
  HardDrive,
  Upload,
  Download,
  Search,
  FileText,
  FileArchive,
  Image as ImageIcon,
  FileCode,
  Eye,
  Filter,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { FileCard } from '@/components/chat/FileCard';

type CategoryFilter = 'all' | 'images' | 'docs' | 'code' | 'archives';

export function ProjectFilesBrowser() {
  const {
    activeProject,
    attachments,
    uploadFile,
  } = useAppStore();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileCategory = (fileName: string, mime?: string): CategoryFilter => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext) || mime?.startsWith('image/')) {
      return 'images';
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'csv', 'tsv', 'md'].includes(ext) || mime?.includes('pdf') || mime?.includes('document')) {
      return 'docs';
    }
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'json', 'yaml', 'sql', 'sh', 'log'].includes(ext)) {
      return 'code';
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
      return 'archives';
    }
    return 'docs';
  };

  const getFileIcon = (category: CategoryFilter) => {
    switch (category) {
      case 'images':
        return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'code':
        return <FileCode className="w-4 h-4 text-cyan-400" />;
      case 'archives':
        return <FileArchive className="w-4 h-4 text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-indigo-400" />;
    }
  };

  // Category counts and total storage
  const { counts, totalBytes } = useMemo(() => {
    const tally = { all: attachments.length, images: 0, docs: 0, code: 0, archives: 0 };
    let bytes = 0;
    attachments.forEach((a) => {
      const cat = getFileCategory(a.fileName, a.fileType || a.mimeType);
      tally[cat] = (tally[cat] || 0) + 1;
      bytes += a.fileSize || 0;
    });
    return { counts: tally, totalBytes: bytes };
  }, [attachments]);

  // Filtered files list
  const filteredFiles = useMemo(() => {
    return attachments.filter((file) => {
      const matchesCategory =
        activeCategory === 'all' ||
        getFileCategory(file.fileName, file.fileType || file.mimeType) === activeCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        file.fileName.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesCategory && matchesSearch;
    });
  }, [attachments, activeCategory, searchQuery]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        await uploadFile(file);
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        await uploadFile(file);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`space-y-3 relative transition-all ${
        isDragOver ? 'ring-2 ring-indigo-500 rounded-xl bg-indigo-950/20' : ''
      }`}
    >
      {/* Storage Header & Stats */}
      <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/40 via-cyan-950/20 to-slate-900 border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-white">Backblaze B2 Bucket</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20 flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5" />
            Private S3
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Total Stored:</span>
          <span className="font-mono text-cyan-300 font-semibold">{formatSize(totalBytes)}</span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
          <span>{attachments.length} files across project channels</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            {isUploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search project files by name..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none focus:border-indigo-500/50 transition-colors"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'images', label: 'Images' },
            { id: 'docs', label: 'Docs' },
            { id: 'code', label: 'Code & Logs' },
            { id: 'archives', label: 'Archives' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 ${
              activeCategory === tab.id
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[10px] font-mono opacity-70">
              ({counts[tab.id] || 0})
            </span>
          </button>
        ))}
      </div>

      {/* Files List */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filteredFiles.map((file) => {
          const category = getFileCategory(file.fileName, file.fileType || file.mimeType);
          const secureDownloadUrl = file.id
            ? `/api/files/${file.id}/download`
            : file.fileUrl || `/api/files/download-fallback?key=${encodeURIComponent(file.storageKey || file.fileName)}`;

          return (
            <div
              key={file.id}
              className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3 hover:bg-white/[0.05] transition-all group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  {getFileIcon(category)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                    {file.fileName}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                    <span>{formatSize(file.fileSize)}</span>
                    <span>•</span>
                    <span className="text-cyan-400 flex items-center gap-0.5">
                      <HardDrive className="w-2.5 h-2.5" />
                      Backblaze B2
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={secureDownloadUrl}
                  download={file.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Download Secure File"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}

        {filteredFiles.length === 0 && (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
            <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-400">
              {searchQuery ? 'No files match your search' : 'No files in this category'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Drop files here or attach them in chat to store in Backblaze B2
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
