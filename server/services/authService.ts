import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { env, getIntegrationStatus } from '../config/env';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateOpaqueToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export interface EmailSendResult {
  status: 'sent' | 'logged_dev' | 'failed';
  previewUrl?: string;
  error?: string;
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailSendResult> {
  const ready = getIntegrationStatus().transactionalEmail;
  if (!ready) {
    console.log(`[Email-DevLog] To: ${params.to} | Subject: ${params.subject}`);
    return { status: 'logged_dev' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });

    await transporter.sendMail({
      from: env.smtp.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { status: 'sent' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown SMTP error';
    console.error('[Email] Delivery error:', msg);
    return { status: 'failed', error: msg };
  }
}

// Ephemeral signed OAuth state token (prevents CSRF & forged callbacks)
export function createSignedOAuthState(provider: 'google' | 'facebook', redirectTo: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      provider,
      redirectTo,
      nonce: crypto.randomBytes(16).toString('hex'),
      iat: Date.now(),
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', env.jwtSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySignedOAuthState(
  state: string,
  expectedProvider: 'google' | 'facebook'
): { redirectTo: string } | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', env.jwtSecret).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsed.provider !== expectedProvider) return null;
    if (Date.now() - parsed.iat > 10 * 60 * 1000) return null; // 10 min expiry
    return { redirectTo: typeof parsed.redirectTo === 'string' ? parsed.redirectTo : '/' };
  } catch {
    return null;
  }
}
