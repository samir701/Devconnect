import bcrypt from 'bcryptjs';
import { User } from './types';
import { getUserById, updateUser, getUsers, getUserByEmail, createUser, saveStoreToDisk } from './db';

// In-memory verification & reset tokens for serverless session lifecycle
declare global {
  // eslint-disable-next-line no-var
  var __devconnect_auth_tokens: {
    verification: Map<string, { email: string; expires: number }>;
    passwordReset: Map<string, { email: string; expires: number }>;
    sessions: Map<string, { userId: string; email: string; expires: number }>;
  } | undefined;
}

if (!globalThis.__devconnect_auth_tokens) {
  globalThis.__devconnect_auth_tokens = {
    verification: new Map(),
    passwordReset: new Map(),
    sessions: new Map(),
  };
}

const authStore = globalThis.__devconnect_auth_tokens;

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function registerUser(params: {
  name: string;
  email: string;
  password: string;
  title?: string;
  skills?: string[];
}): Promise<{ user: User; token: string }> {
  const existing = (await getUserByEmail(params.email)) || (await getUsers()).find((u) => u.email.toLowerCase() === params.email.toLowerCase());
  if (existing) {
    throw new Error('A developer account with this email already exists.');
  }

  const passwordHash = await hashPassword(params.password);
  const id = `user_${Date.now()}`;

  const newUser: User = {
    id,
    name: params.name,
    email: params.email,
    passwordHash,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(params.name)}`,
    title: params.title || 'Software Developer',
    skills: params.skills && params.skills.length > 0 ? params.skills : ['JavaScript', 'TypeScript', 'Node.js'],
    status: 'ONLINE',
    lastSeen: 'Just now',
    currentProjectId: undefined,
  };

  // Persist to TiDB database and in-memory store
  await createUser(newUser);

  const token = `devconn_token_${Date.now()}_${id}`;
  authStore.sessions.set(token, {
    userId: id,
    email: params.email,
    expires: Date.now() + 7 * 86400 * 1000,
  });

  const { passwordHash: _, ...safeUser } = newUser;
  return { user: safeUser as User, token };
}

export async function loginUser(email: string, password?: string): Promise<{ user: User; token: string }> {
  let user = await getUserByEmail(email);
  if (!user) {
    const users = await getUsers();
    user = users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }
  if (!user) {
    throw new Error('No user account found with that email address.');
  }

  if (user.passwordHash) {
    if (!password) {
      throw new Error('Password is required.');
    }
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }
  }

  await updateUser(user.id, { status: 'ONLINE', lastSeen: 'Just now' });
  user.status = 'ONLINE';
  user.lastSeen = 'Just now';

  const token = `devconn_token_${Date.now()}_${user.id}`;
  authStore.sessions.set(token, {
    userId: user.id,
    email: user.email,
    expires: Date.now() + 7 * 86400 * 1000,
  });

  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser as User, token };
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const users = await getUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error('No account found with this email.');
  }

  const resetToken = `rst_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  authStore.passwordReset.set(resetToken, {
    email: user.email,
    expires: Date.now() + 3600 * 1000, // 1 hour
  });

  return resetToken;
}

export async function resetPasswordWithToken(resetToken: string, newPassword: string): Promise<boolean> {
  const record = authStore.passwordReset.get(resetToken);
  if (!record || record.expires < Date.now()) {
    throw new Error('Invalid or expired password reset token.');
  }

  const passwordHash = await hashPassword(newPassword);
  const users = await getUsers();
  const user = users.find((u) => u.email.toLowerCase() === record.email.toLowerCase());
  if (user) {
    await updateUser(user.id, { lastSeen: 'Just now' });
    authStore.passwordReset.delete(resetToken);
    return true;
  }
  return false;
}

export async function sendEmailVerification(email: string): Promise<string> {
  const verifyToken = `vfy_${Math.random().toString(36).substring(2, 10)}`;
  authStore.verification.set(verifyToken, {
    email,
    expires: Date.now() + 86400 * 1000, // 24 hours
  });
  return verifyToken;
}

export async function verifyEmailToken(verifyToken: string): Promise<boolean> {
  const record = authStore.verification.get(verifyToken);
  if (!record || record.expires < Date.now()) {
    return false;
  }
  authStore.verification.delete(verifyToken);
  return true;
}

export async function invalidateSession(token: string): Promise<void> {
  authStore.sessions.delete(token);
}
