'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Code,
  Bug as BugIcon,
  CheckSquare,
  Paperclip,
  Sparkles,
  X,
  AlertTriangle,
  CornerDownRight,
  UploadCloud,
  HardDrive,
  FileText,
  FileArchive,
  Image as ImageIcon,
  FileCode,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { detectSecrets, maskSecret } from '@/lib/secretDetector';
import { SecretWarningModal } from './SecretWarningModal';
import { Message, SecretDetectionResult, Attachment } from '@/lib/types';
import confetti from 'canvas-confetti';

interface MessageComposerProps {
  replyingTo: Message | null;
  onClearReply: () => void;
}

export function MessageComposer({ replyingTo, onClearReply }: MessageComposerProps) {
  const {
    currentUser,
    activeProjectId,
    activeConversation,
    sendMessage,
    triggerTyping,
    setIsCreateBugOpen,
    setIsCreateTaskOpen,
    setActiveRightTab,
    setIsRightPanelOpen,
  } = useAppStore();

  const [text, setText] = useState('');
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('python');
  const [codeFilename, setCodeFilename] = useState('');
  const [secretResult, setSecretResult] = useState<SecretDetectionResult | null>(null);
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);
  const [pendingSend, setPendingSend] = useState(false);

  // Phase 4 File Attachment & Upload State
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Live secret detection as user types
  useEffect(() => {
    const check = detectSecrets(text);
    if (check.hasSecret) {
      setSecretResult(check);
    } else {
      setSecretResult(null);
    }
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (currentUser?.name) {
      triggerTyping(currentUser.name, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        triggerTyping(currentUser.name, false);
      }, 2000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFilePreviewIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext || '')) {
      return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    }
    if (['zip', 'tar', 'gz', 'rar'].includes(ext || '')) {
      return <FileArchive className="w-4 h-4 text-amber-400" />;
    }
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'json', 'yaml', 'sql', 'log'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-cyan-400" />;
    }
    return <FileText className="w-4 h-4 text-indigo-400" />;
  };

  // Direct-to-B2 client upload pipeline with fallback
  const uploadStagedFile = async (file: File): Promise<Attachment | null> => {
    setIsUploading(true);
    setUploadProgress(10);
    setUploadError(null);

    try {
      // 1. Request presigned upload URL from server
      const presignRes = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          projectId: activeProjectId || undefined,
          conversationId: activeConversation?.id || undefined,
        }),
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to authorize file upload');
      }

      const presign = await presignRes.json();
      setUploadProgress(35);

      // 2. Upload file binary
      if (presign.isCloudB2) {
        // Direct-to-B2 S3 presigned PUT with automatic server-relay fallback
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', presign.uploadUrl, true);
            if (presign.headers) {
              Object.entries(presign.headers).forEach(([k, v]) => {
                xhr.setRequestHeader(k, v as string);
              });
            } else {
              xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
            }

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const pct = 35 + Math.round((evt.loaded / evt.total) * 50);
                setUploadProgress(pct);
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setUploadProgress(85);
                resolve();
              } else {
                reject(new Error(`B2 Storage upload failed with status ${xhr.status}`));
              }
            };

            xhr.onerror = () => reject(new Error('Network error uploading to Backblaze B2'));
            xhr.send(file);
          });
        } catch (directErr) {
          console.warn('Direct browser-to-B2 upload encountered error, falling back to server-relayed upload:', directErr);
          const formData = new FormData();
          formData.append('file', file);
          formData.append('storageKey', presign.storageKey);
          if (activeProjectId) formData.append('projectId', activeProjectId);
          if (activeConversation?.id) formData.append('conversationId', activeConversation.id);

          const uploadRes = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            throw directErr;
          }
          setUploadProgress(85);
        }
      } else {
        // Local Serverless Fallback upload
        const formData = new FormData();
        formData.append('file', file);
        if (activeProjectId) formData.append('projectId', activeProjectId);
        if (activeConversation?.id) formData.append('conversationId', activeConversation.id);

        const uploadRes = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Local fallback upload failed');
        }
        setUploadProgress(85);
      }

      // 3. Confirm upload and link metadata in TiDB
      const confirmRes = await fetch('/api/files/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentId: presign.attachmentId || presign.attachment?.id,
          storageKey: presign.storageKey,
          projectId: activeProjectId || undefined,
          conversationId: activeConversation?.id || undefined,
        }),
      });

      setUploadProgress(100);

      const confirmData = await confirmRes.json().catch(() => ({}));
      const resolvedAttachment: Attachment = confirmData.attachment || presign.attachment || {
        id: presign.attachmentId || `att_${Date.now()}`,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        storageProvider: presign.isCloudB2 ? 'backblaze_b2' : 'local_storage',
        storageKey: presign.storageKey,
        fileUrl: `/api/files/download-fallback?key=${encodeURIComponent(presign.storageKey)}`,
        createdAt: new Date().toISOString(),
      };

      return resolvedAttachment;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      console.error('[Upload] Error:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async (bypassSecret = false) => {
    if (!text.trim() && !stagedFile) return;

    if (!bypassSecret && secretResult?.hasSecret) {
      setIsSecretModalOpen(true);
      setPendingSend(true);
      return;
    }

    // Capture values before clearing inputs immediately
    const textToSend = text;
    const isCodeModeToSend = isCodeMode;
    const codeLanguageToSend = codeLanguage;
    const codeFilenameToSend = codeFilename.trim() || undefined;
    const replyingToToSend = replyingTo;
    const fileToUpload = stagedFile;

    // Clear composer inputs immediately so the text box never stays filled while processing
    setText('');
    setStagedFile(null);
    setUploadProgress(0);
    setUploadError(null);
    onClearReply();
    setSecretResult(null);
    setPendingSend(false);
    if (isCodeMode) {
      setIsCodeMode(false);
      setCodeFilename('');
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (currentUser?.name) triggerTyping(currentUser.name, false);

    let attachmentData: Attachment | undefined = undefined;

    // Handle staged file upload first if present
    if (fileToUpload) {
      const uploaded = await uploadStagedFile(fileToUpload);
      if (!uploaded) {
        // Upload failed; do not send incomplete message
        return;
      }
      attachmentData = uploaded;
    }

    const ext = fileToUpload?.name.split('.').pop()?.toLowerCase();
    const isImage = ext && ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext);

    if (isCodeModeToSend) {
      await sendMessage({
        content: textToSend,
        messageType: 'CODE',
        codeLanguage: codeLanguageToSend,
        codeFilename: codeFilenameToSend,
        attachmentData,
        replyToMessageId: replyingToToSend?.id,
        replyToMessage: replyingToToSend
          ? {
              id: replyingToToSend.id,
              senderName: replyingToToSend.sender?.name || 'Developer',
              content: replyingToToSend.content.slice(0, 100),
            }
          : undefined,
      });
    } else {
      const msgType = attachmentData ? (isImage ? 'IMAGE' : 'FILE') : 'TEXT';
      const contentToSend = textToSend.trim() || (fileToUpload ? `Uploaded file: ${fileToUpload.name}` : '');

      await sendMessage({
        content: contentToSend,
        messageType: msgType,
        attachmentData,
        replyToMessageId: replyingToToSend?.id,
        replyToMessage: replyingToToSend
          ? {
              id: replyingToToSend.id,
              senderName: replyingToToSend.sender?.name || 'Developer',
              content: replyingToToSend.content.slice(0, 100),
            }
          : undefined,
      });

      if (attachmentData) {
        try {
          confetti({ particleCount: 35, spread: 60, origin: { y: 0.9 } });
        } catch {}
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRemoveSecret = () => {
    if (secretResult?.matchedText) {
      const cleaned = maskSecret(text, secretResult.matchedText);
      setText(cleaned);
      setSecretResult(null);
      setIsSecretModalOpen(false);
    }
  };

  const handleSendAnyway = () => {
    setIsSecretModalOpen(false);
    handleSend(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStagedFile(file);
      setUploadError(null);
      e.target.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setStagedFile(file);
      setUploadError(null);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-3 border-t border-white/10 bg-[#090d16]/90 backdrop-blur-md relative transition-all ${
        isDragging ? 'ring-2 ring-indigo-500 bg-indigo-950/20' : ''
      }`}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-20 bg-indigo-950/80 backdrop-blur-sm border-2 border-dashed border-indigo-400 rounded-xl flex items-center justify-center gap-3 text-white pointer-events-none">
          <UploadCloud className="w-8 h-8 text-indigo-400 animate-bounce" />
          <div className="text-center">
            <p className="text-sm font-semibold">Drop file to attach</p>
            <p className="text-xs text-indigo-300 font-mono">Stream directly to Backblaze B2 (Max 25MB)</p>
          </div>
        </div>
      )}

      {/* Secret Intercept Modal */}
      <SecretWarningModal
        isOpen={isSecretModalOpen}
        secretResult={secretResult}
        onRemoveSecret={handleRemoveSecret}
        onSendAnyway={handleSendAnyway}
        onClose={() => setIsSecretModalOpen(false)}
      />

      {/* Secret Detection Active Banner */}
      {secretResult?.hasSecret && (
        <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Potential secret detected in input: <strong>{secretResult.secretType}</strong>
            </span>
          </div>
          <button
            onClick={() => setIsSecretModalOpen(true)}
            className="text-[11px] underline hover:text-white font-medium"
          >
            Review & Mask
          </button>
        </div>
      )}

      {/* Replying banner */}
      {replyingTo && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-300">
          <div className="flex items-center gap-1.5 truncate">
            <CornerDownRight className="w-3.5 h-3.5" />
            <span>
              Replying to <strong>{replyingTo.sender?.name}</strong>:
            </span>
            <span className="truncate italic text-slate-400 max-w-sm">
              {replyingTo.content}
            </span>
          </div>
          <button
            onClick={onClearReply}
            className="text-slate-400 hover:text-white p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Staged File Preview Chip & Progress Bar */}
      {stagedFile && (
        <div className="mb-2 p-2.5 rounded-xl bg-[#0f172a] border border-cyan-500/30 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                {getFilePreviewIcon(stagedFile.name)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                  {stagedFile.name}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>{formatFileSize(stagedFile.size)}</span>
                  <span>•</span>
                  <span className="text-cyan-400 flex items-center gap-1">
                    <HardDrive className="w-2.5 h-2.5" />
                    Backblaze B2 Ready
                  </span>
                </div>
              </div>
            </div>

            {!isUploading && (
              <button
                onClick={() => {
                  setStagedFile(null);
                  setUploadError(null);
                }}
                className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-cyan-300 font-mono">
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                  Streaming to Backblaze B2...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* Code Mode Meta Bar */}
      {isCodeMode && (
        <div className="mb-2 p-2 rounded-xl bg-[#060911] border border-cyan-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-cyan-400">Code Snippet Mode</span>
            <select
              value={codeLanguage}
              onChange={(e) => setCodeLanguage(e.target.value)}
              className="bg-white text-black font-semibold rounded-md px-2.5 py-1 outline-none text-xs border border-slate-300 shadow-sm cursor-pointer hover:bg-slate-50 focus:ring-2 focus:ring-cyan-500 transition-colors"
            >
              <option value="python" className="text-black bg-white">Python</option>
              <option value="typescript" className="text-black bg-white">TypeScript</option>
              <option value="javascript" className="text-black bg-white">JavaScript</option>
              <option value="go" className="text-black bg-white">Go</option>
              <option value="rust" className="text-black bg-white">Rust</option>
              <option value="sql" className="text-black bg-white">SQL</option>
              <option value="bash" className="text-black bg-white">Bash</option>
              <option value="json" className="text-black bg-white">JSON</option>
              <option value="yaml" className="text-black bg-white">YAML</option>
              <option value="java" className="text-black bg-white">Java</option>
              <option value="cpp" className="text-black bg-white">C++</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Filename (e.g. auth/verifier.py)"
            value={codeFilename}
            onChange={(e) => setCodeFilename(e.target.value)}
            className="bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white placeholder-slate-500 outline-none flex-1 max-w-xs font-mono"
          />

          <button
            onClick={() => setIsCodeMode(false)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="relative rounded-2xl border border-white/10 bg-[#0d1322] focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-inner">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={
            stagedFile
              ? `Add a comment about ${stagedFile.name} (optional, Enter to send)...`
              : isCodeMode
              ? 'Paste or type code snippet here...'
              : 'Type a message... (Markdown, @mentions, code, Enter to send)'
          }
          rows={isCodeMode ? 4 : stagedFile ? 2 : 2}
          className={`w-full bg-transparent px-4 py-3 text-sm text-white placeholder-slate-400 outline-none resize-none ${
            isCodeMode ? 'font-mono text-xs text-emerald-300' : ''
          }`}
        />

        {/* Toolbar & Send Button */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsCodeMode(!isCodeMode)}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                isCodeMode
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Send Code Snippet"
            >
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Code</span>
            </button>

            <button
              onClick={() => setIsCreateBugOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs flex items-center gap-1 transition-colors"
              title="Report Bug (🐛)"
            >
              <BugIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Bug</span>
            </button>

            <button
              onClick={() => setIsCreateTaskOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 text-xs flex items-center gap-1 transition-colors"
              title="Create Task (📋)"
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Task</span>
            </button>

            {/* Attach File Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                stagedFile
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
              title="Attach File to Backblaze B2 (📎)"
            >
              <Paperclip className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">
                {stagedFile ? 'Attached' : 'File'}
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={() => {
                setActiveRightTab('ai');
                setIsRightPanelOpen(true);
              }}
              className="p-1.5 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs flex items-center gap-1 transition-colors"
              title="Project AI Assistant"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">AI</span>
            </button>
          </div>

          {/* Send Button */}
          <button
            onClick={() => handleSend()}
            disabled={(!text.trim() && !stagedFile) || isUploading}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              (text.trim() || stagedFile) && !isUploading
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 cursor-pointer'
                : 'bg-white/5 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
