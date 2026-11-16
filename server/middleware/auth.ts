import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser, UserRole } from '../models/User';
import { Store, IStore } from '../models/Seller';
import { AuditLog } from '../models/Cms';

export interface AuthRequest extends Request {
  user?: IUser;
  store?: IStore;
}

export const ADMIN_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'catalog_manager',
  'order_manager',
  'finance_manager',
  'support_agent',
  'content_manager',
];

export function signSessionToken(user: IUser): string {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      email: user.email,
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  );
}

function isHttpsRequest(req?: Request): boolean {
  if (env.isProd || env.appUrl.startsWith('https://')) return true;
  if (!req) return false;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return Boolean(req.secure || forwardedProto === 'https');
}

export function setSessionCookie(res: Response, token: string, req?: Request): void {
  const https = isHttpsRequest(req);
  res.cookie(env.sessionCookieName, token, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, req?: Request): void {
  const https = isHttpsRequest(req);
  res.clearCookie(env.sessionCookieName, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    path: '/',
  });
}

async function resolveUserFromRequest(req: Request): Promise<IUser | null> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const cookieToken = req.cookies?.[env.sessionCookieName];
  const candidates = [bearerToken, cookieToken].filter(
    (t): t is string => Boolean(t && typeof t === 'string')
  );

  for (const token of candidates) {
    try {
      const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
      const user = await User.findById(payload.sub);
      if (user && user.status === 'active') return user;
    } catch {
      // Try next token candidate
    }
  }
  return null;
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  req.user = (await resolveUserFromRequest(req)) || undefined;
  next();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await resolveUserFromRequest(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  req.user = user;
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      const resolved = await resolveUserFromRequest(req);
      if (resolved) req.user = resolved;
    }
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (req.user.role === 'super_admin') {
      next();
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions for this operation',
      });
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole(...ADMIN_ROLES);

export async function requireApprovedSeller(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    const resolved = await resolveUserFromRequest(req);
    if (resolved) req.user = resolved;
  }
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'seller' && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Approved Seller account required. Apply via Become a Seller first.',
    });
    return;
  }
  const store = await Store.findOne({ ownerUserId: req.user._id });
  if (!store) {
    res.status(403).json({
      success: false,
      error: 'No approved store found for this account.',
    });
    return;
  }
  if (store.status !== 'active') {
    res.status(403).json({
      success: false,
      error: 'Your seller store is currently suspended. Contact platform support.',
    });
    return;
  }
  req.store = store;
  next();
}

export async function recordAuditLog(params: {
  req: AuthRequest;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
}) {
  if (!params.req.user) return;
  try {
    await AuditLog.create({
      actorUserId: params.req.user._id,
      actorEmail: params.req.user.email,
      actorRole: params.req.user.role,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      details: params.details || {},
      ipAddress: params.req.ip,
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record:', err);
  }
}
