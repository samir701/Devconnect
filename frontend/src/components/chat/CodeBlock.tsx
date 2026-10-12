'use client';

import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode, Code2 } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  ts: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  javascript: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  js: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  python: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  py: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  go: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  golang: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  rust: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  rs: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  java: 'text-red-400 bg-red-500/10 border-red-500/20',
  cpp: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  'c++': 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  c: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  sql: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  bash: 'text-lime-400 bg-lime-500/10 border-lime-500/20',
  sh: 'text-lime-400 bg-lime-500/10 border-lime-500/20',
  json: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'class', 'extends', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'default', 'null', 'undefined', 'true', 'false'],
  typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'class', 'extends', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'interface', 'type', 'enum', 'implements', 'public', 'private', 'protected', 'readonly', 'as', 'keyof', 'typeof', 'null', 'undefined', 'true', 'false'],
  python: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'class', 'try', 'except', 'finally', 'raise', 'with', 'as', 'pass', 'lambda', 'yield', 'None', 'True', 'False', 'is', 'in', 'not', 'and', 'or', 'self', 'async', 'await'],
  go: ['func', 'return', 'if', 'else', 'for', 'range', 'import', 'package', 'type', 'struct', 'interface', 'go', 'chan', 'defer', 'select', 'case', 'default', 'nil', 'true', 'false', 'var', 'const', 'make', 'new'],
  rust: ['fn', 'let', 'mut', 'pub', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'use', 'mod', 'crate', 'struct', 'enum', 'impl', 'trait', 'type', 'async', 'await', 'self', 'Self', 'None', 'Some', 'Ok', 'Err', 'true', 'false'],
  java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'throw', 'throws', 'static', 'final', 'void', 'int', 'String', 'boolean', 'null', 'true', 'false'],
  cpp: ['#include', 'namespace', 'using', 'class', 'struct', 'template', 'typename', 'public', 'private', 'protected', 'return', 'if', 'else', 'for', 'while', 'auto', 'const', 'constexpr', 'virtual', 'override', 'new', 'delete', 'nullptr', 'true', 'false'],
  sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'SET', 'DELETE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'ON', 'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'HAVING', 'UNION', 'ALL', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'EXISTS', 'COUNT', 'SUM', 'AVG'],
  bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'export', 'echo', 'exit', 'source', 'local', 'alias', 'sudo', 'curl', 'wget', 'git', 'npm', 'yarn', 'pnpm', 'docker', 'grep', 'sed', 'awk'],
  json: ['true', 'false', 'null'],
};

export function CodeBlock({ code, language = 'typescript', filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const cleanLang = (language || 'typescript').toLowerCase();
  const langBadgeStyle = LANGUAGE_COLORS[cleanLang] || 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const lines = code.trim().split('\n');

  return (
    <div className="my-2.5 rounded-xl border border-white/10 bg-[#060911] overflow-hidden shadow-xl group">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-white/[0.03]">
        <div className="flex items-center space-x-2">
          {filename ? (
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
          ) : (
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span className="text-xs font-mono font-medium text-slate-200">
            {filename || cleanLang.toUpperCase()}
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold uppercase tracking-wider ${langBadgeStyle}`}>
            {cleanLang}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 cursor-pointer shadow-sm"
          title="Copy Code to Clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="p-3 font-mono text-xs overflow-x-auto text-slate-200 leading-relaxed max-h-[420px] selection:bg-indigo-500/30">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-white/[0.02]">
                <td className="w-8 pr-4 text-right text-slate-600 select-none text-[11px] align-top font-mono">
                  {idx + 1}
                </td>
                <td className="whitespace-pre font-mono text-slate-200 align-top">
                  {highlightSyntax(line, cleanLang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Lightweight multi-language syntax highlighter
function highlightSyntax(line: string, lang: string) {
  // Comments
  if (
    line.trim().startsWith('//') ||
    line.trim().startsWith('#') ||
    line.trim().startsWith('--') ||
    line.trim().startsWith('/*')
  ) {
    return <span className="text-slate-500 italic">{line}</span>;
  }

  const defaultKeywords = LANGUAGE_KEYWORDS.javascript;
  const keywords = LANGUAGE_KEYWORDS[lang] || defaultKeywords;

  // Split tokens by strings, spaces, symbols
  const regex = new RegExp(`(\\b(?:${keywords.join('|')})\\b|"[^"]*"|'[^']*'|\`[^\`]*\`|\\b\\d+(?:\\.\\d+)?\\b)`, 'g');
  const parts = line.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        if (!part) return null;
        if (keywords.includes(part)) {
          return (
            <span key={i} className="text-purple-400 font-semibold">
              {part}
            </span>
          );
        }
        if (
          (part.startsWith('"') && part.endsWith('"')) ||
          (part.startsWith("'") && part.endsWith("'")) ||
          (part.startsWith('`') && part.endsWith('`'))
        ) {
          return (
            <span key={i} className="text-emerald-300">
              {part}
            </span>
          );
        }
        if (/^\d+(\.\d+)?$/.test(part.trim())) {
          return (
            <span key={i} className="text-amber-300 font-medium">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
