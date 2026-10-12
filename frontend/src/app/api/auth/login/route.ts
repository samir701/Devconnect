import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth.service';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { user, token } = await loginUser(email, password);

    return NextResponse.json({
      success: true,
      user,
      token,
      message: 'Login successful!',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid login credentials';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
