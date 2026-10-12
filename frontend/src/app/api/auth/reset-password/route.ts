import { NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/auth.service';

export async function POST(request: Request) {
  try {
    const { token, newPassword } = await request.json();
    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const success = await resetPasswordWithToken(token, newPassword);
    if (!success) {
      return NextResponse.json({ error: 'Reset failed' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You may now log in.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Reset failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
