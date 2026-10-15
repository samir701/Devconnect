/**
 * Utility functions for parsing and normalizing conversation IDs and participant IDs.
 * Handles user IDs that contain underscores (e.g. "user_1739..." or "usr_...").
 */

export function extractParticipantIds(convId?: string | null, knownSenderId?: string | null): string[] {
  if (!convId) return [];
  const clean = convId.startsWith('dm_') ? convId.slice(3) : convId;

  // Case 1: If knownSenderId is provided and present in the clean string
  if (knownSenderId) {
    if (clean.startsWith(`${knownSenderId}_`)) {
      const other = clean.slice(knownSenderId.length + 1);
      return [knownSenderId, other];
    }
    if (clean.endsWith(`_${knownSenderId}`)) {
      const other = clean.slice(0, clean.length - knownSenderId.length - 1);
      return [other, knownSenderId];
    }
  }

  // Case 2: Matching two user_* or usr_* ids: e.g. "user_123_user_456" or "usr_123_usr_456"
  const prefixMatch = clean.match(/^((?:user|usr)_[^_]+)_((?:user|usr)_[^_]+)$/);
  if (prefixMatch) {
    return [prefixMatch[1], prefixMatch[2]];
  }

  // Case 3: If it was split into 4 parts like ['user', '123', 'user', '456']
  const parts = clean.split('_');
  if (parts.length === 4 && (parts[0] === 'user' || parts[0] === 'usr') && (parts[2] === 'user' || parts[2] === 'usr')) {
    return [`${parts[0]}_${parts[1]}`, `${parts[2]}_${parts[3]}`];
  }

  // Case 4: Standard 2-part split (e.g. u123_u456)
  if (parts.length === 2) {
    return parts;
  }

  // Case 5: If more underscores exist, split around '_user_' or '_usr_'
  const midUser = clean.indexOf('_user_');
  if (midUser > 0) {
    return [clean.slice(0, midUser), clean.slice(midUser + 1)];
  }
  const midUsr = clean.indexOf('_usr_');
  if (midUsr > 0) {
    return [clean.slice(0, midUsr), clean.slice(midUsr + 1)];
  }

  return parts;
}

export function normalizeConversationId(convId?: string | null): string {
  if (!convId) return '';
  const pIds = extractParticipantIds(convId);
  if (pIds.length === 2) {
    return [pIds[0], pIds[1]].sort().join('_');
  }
  return convId.startsWith('dm_') ? convId.slice(3) : convId;
}
