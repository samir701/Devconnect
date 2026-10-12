import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, title, skills } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const { user, token } = await registerUser({ name, email, password, title, skills });

    return NextResponse.json({
      success: true,
      user,
      token,
      message: 'Account created successfully! Verification email generated.',
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
