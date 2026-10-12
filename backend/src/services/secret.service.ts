import { SecretDetectionResult } from '../types';

interface SecretRule {
  name: string;
  pattern: RegExp;
  hint: string;
}

const SECRET_PATTERNS: SecretRule[] = [
  {
    name: 'OpenAI / Claude API Key',
    pattern: /(sk-[a-zA-Z0-9]{20,}|sk-ant-[a-zA-Z0-9]{20,})/i,
    hint: 'OpenAI / Anthropic Secret API Key',
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z-_]{35}/,
    hint: 'Google Cloud / Gemini API Key',
  },
  {
    name: 'GitHub Personal Access Token',
    pattern: /(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{40,})/i,
    hint: 'GitHub Personal Access Token',
  },
  {
    name: 'AWS Access Key ID',
    pattern: /(?:AKIA|ASIA)[0-9A-Z]{16}/,
    hint: 'AWS Access Key ID',
  },
  {
    name: 'Private Key Block',
    pattern: /-----BEGIN\s+(?:RSA|OPENSSH|EC|DSA|PGP|PRIVATE)\s+KEY/i,
    hint: 'Private Cryptographic Key',
  },
  {
    name: 'Hardcoded Secret Assignment',
    pattern: /(?:api_key|apikey|secret_key|secretkey|auth_token|client_secret|db_password)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.\$]{8,})["']?/i,
    hint: 'Hardcoded credentials or API token assignment',
  },
  {
    name: 'Database URL with Password',
    pattern: /(?:mysql|postgresql|postgres|mongodb|redis):\/\/[a-zA-Z0-9_]+:[^@\s]+@[a-zA-Z0-9.-]+/i,
    hint: 'Database Connection String containing plaintext password',
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/,
    hint: 'Slack Bot or User OAuth Token',
  },
];

export function detectSecrets(text: string): SecretDetectionResult {
  if (!text || text.trim().length === 0) {
    return { hasSecret: false };
  }

  for (const rule of SECRET_PATTERNS) {
    const match = text.match(rule.pattern);
    if (match) {
      return {
        hasSecret: true,
        secretType: rule.name,
        matchedText: match[0],
        hint: rule.hint,
      };
    }
  }

  return { hasSecret: false };
}

export function maskSecret(text: string, matchedText: string): string {
  if (!matchedText) return text;
  const masked = matchedText.slice(0, 3) + '••••••••' + (matchedText.length > 8 ? matchedText.slice(-3) : '');
  return text.replace(matchedText, masked);
}
