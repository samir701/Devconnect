import { NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/lib/auth.service';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const resetToken = await createPasswordResetToken(email);

    return NextResponse.json({
      success: true,
      resetToken,
      message: `Password reset link generated for ${email}. Reset token: ${resetToken}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error processing request';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
