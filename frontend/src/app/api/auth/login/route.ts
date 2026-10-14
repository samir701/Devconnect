import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth.service';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { user, token } = await loginUser(email, password);

    const res = NextResponse.json({
      success: true,
      user,
      token,
      message: 'Login successful!',
    });

    res.cookies.set('devconnect_token', token, {
      path: '/',
      maxAge: 7 * 86400,
      sameSite: 'lax',
    });
    res.cookies.set('devconnect_user_id', user.id, {
      path: '/',
      maxAge: 7 * 86400,
      sameSite: 'lax',
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid login credentials';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
