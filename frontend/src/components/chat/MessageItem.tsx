'use client';

import React, { useState } from 'react';
import { Message } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { CodeBlock } from './CodeBlock';
import { BugCard } from './BugCard';
import { TaskCard } from './TaskCard';
import { FileCard } from './FileCard';
import { useAppStore } from '@/lib/store';
import {
  MoreVertical,
  Reply,
  Smile,
  CheckSquare,
  Bug as BugIcon,
  Trash2,
  Copy,
  Edit2,
  CornerDownRight,
  Check,
  CheckCheck,
  AlertCircle,
  X,
} from 'lucide-react';

interface MessageItemProps {
  message: Message;
  onReplySelect?: (msg: Message) => void;
  isConsecutive?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '🚀', '🔥', '🐛', '👀', '🎉', '💡'];

function DeliveryStatusIcon({
  status,
  size = 'sm',
}: {
  status?: 'sending' | 'sent' | 'delivered' | 'error';
  size?: 'xs' | 'sm';
}) {
  const isXs = size === 'xs';
  const iconClass = isXs ? 'w-3 h-3' : 'w-3.5 h-3.5';

  if (status === 'sending') {
    return (
      <span
        className="inline-flex items-center text-slate-400 select-none"
        title="Sending..."
      >
        <Check className={`${iconClass} text-slate-400 animate-pulse`} />
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span
        className="inline-flex items-center text-rose-400 select-none"
        title="Failed to deliver. Please try again."
      >
        <AlertCircle className={`${iconClass} text-rose-400`} />
      </span>
    );
  }

  // Delivered (default state for confirmed messages)
  return (
    <span
      className="inline-flex items-center text-cyan-400 select-none animate-in zoom-in-75 duration-150"
      title="Delivered"
    >
      <CheckCheck className={`${iconClass} text-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.35)]`} />
    </span>
  );
}

export function MessageItem({ message, onReplySelect, isConsecutive = false }: MessageItemProps) {
  const {
    currentUser,
    tasks,
    bugs,
    toggleReaction,
    editMessage,
    deleteMessage,
    convertMessageToBug,
    convertMessageToTask,
  } = useAppStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isMe = currentUser?.id === message.senderId;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setIsMenuOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setIsSavingEdit(true);
    try {
      await editMessage(message.id, editContent.trim());
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to edit message:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Resolve Bug data synced with store
  let bugMeta: any = null;
  try { if (message.metadata) bugMeta = JSON.parse(message.metadata); } catch {}
  const targetBugId = message.bugData?.id || bugMeta?.bugId || `bug_${message.id}`;
  const storeBug = bugs.find(
    (b) => b.id === targetBugId || b.id === bugMeta?.bugId || b.messageId === message.id
  );
  const resolvedBug = storeBug || message.bugData || (message.messageType === 'BUG' ? {
    id: targetBugId,
    projectId: message.projectId || 'proj_ai_employee',
    messageId: message.id,
    title: bugMeta?.title || message.content.replace(/^🐛\s*(?:\*\*\[BUG\]\*\*)?:?\s*/i, '').slice(0, 80) || 'Bug Report',
    description: bugMeta?.description || message.content,
    endpoint: bugMeta?.endpoint || '',
    priority: bugMeta?.priority || 'HIGH',
    status: bugMeta?.status || 'OPEN',
    assignedTo: bugMeta?.assignedTo || message.senderId,
    assigneeUser: message.sender,
    createdBy: message.senderId,
    createdAt: message.createdAt,
  } : null);

  // Resolve Task data synced with store
  let taskMeta: any = null;
  try { if (message.metadata) taskMeta = JSON.parse(message.metadata); } catch {}
  const targetTaskId = message.taskData?.id || taskMeta?.taskId || `task_${message.id}`;
  const storeTask = tasks.find(
    (t) => t.id === targetTaskId || t.id === taskMeta?.taskId || t.messageId === message.id
  );
  const resolvedTask = storeTask || message.taskData || (message.messageType === 'TASK' ? {
    id: targetTaskId,
    projectId: message.projectId || 'proj_ai_employee',
    messageId: message.id,
    title: taskMeta?.title || message.content.replace(/^📋\s*(?:\*\*\[TASK\]\*\*)?:?\s*/i, '').slice(0, 80) || 'Task',
    description: taskMeta?.description || message.content,
    priority: taskMeta?.priority || 'MEDIUM',
    status: taskMeta?.status || 'TODO',
    assignedTo: taskMeta?.assignedTo || message.senderId,
    assigneeUser: message.sender,
    createdBy: message.senderId,
    dueDate: taskMeta?.dueDate || 'Today',
    createdAt: message.createdAt,
  } : null);

  return (
    <div
      className={`relative group px-4 py-1.5 hover:bg-white/[0.02] transition-colors rounded-xl flex gap-3.5 my-0.5 ${
        isConsecutive ? 'mt-0' : 'mt-2'
      }`}
    >
      {/* Sender Avatar (hidden on consecutive grouped messages from same sender) */}
      {!isConsecutive ? (
        <Avatar
          name={message.sender?.name || 'Developer'}
          avatarUrl={message.sender?.avatarUrl}
          status={message.sender?.status}
          size="md"
          className="mt-0.5"
        />
      ) : (
        <div className="w-10 flex items-center justify-center shrink-0">
          <span
            className={`text-[9px] text-slate-600 transition-opacity select-none font-mono flex items-center gap-1 ${
              message.status === 'sending' || message.status === 'error'
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            }`}
            suppressHydrationWarning
          >
            <span>{formatTimestamp(message.createdAt)}</span>
            {isMe && <DeliveryStatusIcon status={message.status} size="xs" />}
          </span>
        </div>
      )}

      {/* Message Content Container */}
      <div className="flex-1 min-w-0">
        {/* Reply Quote Banner */}
        {message.replyToMessage && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 pl-2 border-l-2 border-indigo-500/40 py-0.5 bg-white/[0.01] rounded-r">
            <CornerDownRight className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-300">
              {message.replyToMessage.senderName}:
            </span>
            <span className="truncate italic max-w-sm">
              {message.replyToMessage.content}
            </span>
          </div>
        )}

        {/* Sender Name & Meta Header */}
        {!isConsecutive && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-white tracking-tight">
              {message.sender?.name || 'Developer'}
            </span>

            {isMe && (
              <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-mono">
                You
              </span>
            )}

            {message.sender?.headline && (
              <span className="text-[11px] text-slate-500 truncate max-w-xs hidden sm:inline">
                {message.sender.headline}
              </span>
            )}

            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1" suppressHydrationWarning>
              <span>{formatTimestamp(message.createdAt)}</span>
              {isMe && <DeliveryStatusIcon status={message.status} />}
            </span>

            {message.isEdited && (
              <span className="text-[10px] text-slate-500 italic">
                (edited)
              </span>
            )}
          </div>
        )}

        {/* Inline Editing Mode */}
        {isEditing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-indigo-500/40 text-xs text-white focus:outline-none resize-none font-sans"
              rows={3}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editContent.trim()}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
                <span>Save</span>
              </button>
              <button
                onClick={() => {
                  setEditContent(message.content);
                  setIsEditing(false);
                }}
                className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Primary Content based on messageType */}
            {message.messageType === 'CODE' ? (
              <div className="my-1.5">
                <CodeBlock
                  code={message.content}
                  language={message.codeLanguage || 'python'}
                  filename={message.codeFilename}
                />
              </div>
            ) : message.messageType === 'BUG' && resolvedBug ? (
              <div className="my-1.5">
                <BugCard bug={resolvedBug} />
              </div>
            ) : message.messageType === 'TASK' && resolvedTask ? (
              <div className="my-1.5">
                <TaskCard task={resolvedTask} />
              </div>
            ) : (message.messageType === 'FILE' || message.messageType === 'IMAGE' || message.attachmentData) && message.attachmentData ? (
              <div className="my-1.5 space-y-1.5">
                {message.content && !message.content.startsWith('Uploaded file: ') && (
                  <p
                    className={`text-xs sm:text-sm text-slate-200 leading-relaxed break-words whitespace-pre-wrap selection:bg-indigo-500/30 transition-opacity ${
                      message.status === 'sending' ? 'opacity-80' : 'opacity-100'
                    }`}
                  >
                    {message.content}
                    {isMe && (
                      <span className="inline-flex items-center ml-1.5 align-middle">
                        <DeliveryStatusIcon status={message.status} size="xs" />
                      </span>
                    )}
                    {message.isEdited && (
                      <span className="text-[10px] text-slate-500 italic ml-1.5">
                        (edited)
                      </span>
                    )}
                  </p>
                )}
                <FileCard attachment={message.attachmentData} />
              </div>
            ) : (
              <p
                className={`text-xs sm:text-sm text-slate-200 leading-relaxed break-words whitespace-pre-wrap selection:bg-indigo-500/30 transition-opacity ${
                  message.status === 'sending' ? 'opacity-80' : 'opacity-100'
                }`}
              >
                {message.content}
                {isMe && (
                  <span className="inline-flex items-center ml-1.5 align-middle">
                    <DeliveryStatusIcon status={message.status} size="xs" />
                  </span>
                )}
                {message.isEdited && (
                  <span className="text-[10px] text-slate-500 italic ml-1.5">
                    (edited)
                  </span>
                )}
              </p>
            )}
          </>
        )}

        {/* Reaction Badges List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {message.reactions.map((r) => {
              const hasReacted = currentUser && r.userIds.includes(currentUser.id);
              return (
                <button
                  key={r.emoji}
                  onClick={() => toggleReaction(message.id, r.emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-all ${
                    hasReacted
                      ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                  title={`${r.userIds.length} reaction${r.userIds.length === 1 ? '' : 's'}`}
                >
                  <span>{r.emoji}</span>
                  <span className="text-[11px] font-mono">{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Developer Hover Actions Bar */}
      <div className="absolute top-2 right-4 hidden group-hover:flex items-center gap-1 bg-[#0f1422] border border-white/10 rounded-xl shadow-xl px-1.5 py-1 z-10 animate-in fade-in duration-150">
        {/* Reply Action */}
        <button
          onClick={() => onReplySelect?.(message)}
          className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-white/5 rounded-lg transition-colors"
          title="Reply to message"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>

        {/* Quick Convert to Task */}
        <button
          onClick={() => convertMessageToTask(message)}
          className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-white/5 rounded-lg transition-colors"
          title="Convert to Task"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>

        {/* Quick Convert to Bug */}
        <button
          onClick={() => convertMessageToBug(message)}
          className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-white/5 rounded-lg transition-colors"
          title="Convert to Bug"
        >
          <BugIcon className="w-3.5 h-3.5" />
        </button>

        {/* Emoji Reaction Picker Trigger */}
        <div className="relative">
          <button
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-white/5 rounded-lg transition-colors"
            title="React with emoji"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          {/* Emoji Popover */}
          {isEmojiPickerOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 p-2 bg-[#0c101b] border border-white/10 rounded-xl shadow-2xl flex items-center gap-1.5 z-20">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    toggleReaction(message.id, emoji);
                    setIsEmojiPickerOpen(false);
                  }}
                  className="p-1 text-base hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Edit Action (Author only) */}
        {isMe && message.messageType === 'TEXT' && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-white/5 rounded-lg transition-colors"
            title="Edit message"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* More Actions Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="More actions"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#0c101b] border border-white/10 rounded-xl shadow-2xl p-1 z-20 space-y-0.5 text-xs">
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Text</span>
              </button>

              <button
                onClick={() => {
                  convertMessageToBug(message);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-300 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                <BugIcon className="w-3.5 h-3.5 text-rose-400" />
                <span>Convert to Bug</span>
              </button>

              <button
                onClick={() => {
                  convertMessageToTask(message);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Convert to Task</span>
              </button>

              {isMe && (
                <button
                  onClick={() => {
                    deleteMessage(message.id);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors border-t border-white/5 pt-1.5 mt-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Message</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
