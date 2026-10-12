import { NextResponse } from 'next/server';
import { verifyEmailToken, sendEmailVerification } from '@/lib/auth.service';

export async function POST(request: Request) {
  try {
    const { token, email } = await request.json();

    if (token) {
      const verified = await verifyEmailToken(token);
      if (!verified) {
        return NextResponse.json({ error: 'Invalid or expired verification token.' }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Email verified successfully!' });
    }

    if (email) {
      const generatedToken = await sendEmailVerification(email);
      return NextResponse.json({
        success: true,
        token: generatedToken,
        message: `Verification code sent to ${email}: ${generatedToken}`,
      });
    }

    return NextResponse.json({ error: 'Token or email is required.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
