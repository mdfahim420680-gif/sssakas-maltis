import { Router } from 'express';
import { env, getIntegrationStatus } from '../config/env';
import {
  AuthRequest,
  clearSessionCookie,
  optionalAuth,
  requireAuth,
  setSessionCookie,
  signSessionToken,
} from '../middleware/auth';
import { User } from '../models/User';
import { SellerApplication, Store } from '../models/Seller';
import { Notification, SupportTicket } from '../models/Engagement';
import { CanonicalProduct } from '../models/Catalog';
import { attachBestOffersToProducts } from '../services/catalogService';
import {
  createSignedOAuthState,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  sendTransactionalEmail,
  verifyPassword,
  verifySignedOAuthState,
} from '../services/authService';
import { addressSchema, loginSchema, registerSchema, supportTicketSchema } from '../../shared/validation';
import crypto from 'crypto';

const router = Router();

function serializeUser(u: any) {
  return {
    _id: String(u._id),
    name: u.name,
    email: u.email,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    role: u.role,
    permissions: u.permissions || [],
    emailVerified: u.emailVerified,
    addresses: u.addresses || [],
    wishlistCount: (u.wishlistProductIds || []).length,
  };
}

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid input' });
      return;
    }

    const existing = await User.findOne({ email: parsed.data.email });
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const { rawToken, tokenHash } = generateOpaqueToken();

    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash,
      role: 'customer', // Public signup can never grant seller/admin roles
      emailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const verifyUrl = `${env.appUrl}/verify-email?token=${rawToken}`;
    await sendTransactionalEmail({
      to: user.email,
      subject: 'Verify your NOVARA account',
      text: `Welcome to NOVARA! Verify your email: ${verifyUrl}`,
      html: `<p>Welcome to <strong>NOVARA</strong>! Click <a href="${verifyUrl}">here</a> to verify your email.</p>`,
    });

    const token = signSessionToken(user);
    setSessionCookie(res, token, req);

    res.status(201).json({
      success: true,
      token,
      user: serializeUser(user),
      devVerificationToken: env.isProd ? undefined : rawToken,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid credentials' });
      return;
    }

    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ success: false, error: `Your account is ${user.status}. Contact support.` });
      return;
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signSessionToken(user);
    setSessionCookie(res, token, req);

    const store = await Store.findOne({ ownerUserId: user._id }).lean();
    const application = await SellerApplication.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      token,
      user: serializeUser(user),
      sellerStore: store ? { _id: String(store._id), name: store.name, slug: store.slug, status: store.status } : null,
      sellerApplication: application ? { _id: String(application._id), status: application.status, storeName: application.storeName } : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Login failed' });
  }
});

router.post('/super-admin-login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid credentials' });
      return;
    }

    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ success: false, error: `Your account is ${user.status}. Contact support.` });
      return;
    }

    if (user.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        error: 'Access denied. Only an authorized Super Admin account may use this portal.',
      });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signSessionToken(user);
    setSessionCookie(res, token, req);

    const store = await Store.findOne({ ownerUserId: user._id }).lean();
    const application = await SellerApplication.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      token,
      user: serializeUser(user),
      sellerStore: store ? { _id: String(store._id), name: store.name, slug: store.slug, status: store.status } : null,
      sellerApplication: application ? { _id: String(application._id), status: application.status, storeName: application.storeName } : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Authentication failed' });
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res, req);
  res.json({ success: true });
});

router.get('/session', optionalAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.json({ success: true, authenticated: false, user: null, sellerStore: null, sellerApplication: null });
    return;
  }
  const user = req.user;
  const store = await Store.findOne({ ownerUserId: user._id }).lean();
  const application = await SellerApplication.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();
  const unreadNotifications = await Notification.countDocuments({ recipientUserId: user._id, read: false });

  const token = signSessionToken(user);
  res.json({
    success: true,
    authenticated: true,
    token,
    user: serializeUser(user),
    unreadNotifications,
    sellerStore: store ? { _id: String(store._id), name: store.name, slug: store.slug, status: store.status } : null,
    sellerApplication: application
      ? { _id: String(application._id), status: application.status, storeName: application.storeName, reviewNotes: application.reviewNotes }
      : null,
  });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;
  const store = await Store.findOne({ ownerUserId: user._id }).lean();
  const application = await SellerApplication.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();
  const unreadNotifications = await Notification.countDocuments({ recipientUserId: user._id, read: false });

  res.json({
    success: true,
    user: serializeUser(user),
    unreadNotifications,
    sellerStore: store ? { _id: String(store._id), name: store.name, slug: store.slug, status: store.status } : null,
    sellerApplication: application
      ? { _id: String(application._id), status: application.status, storeName: application.storeName, reviewNotes: application.reviewNotes }
      : null,
  });
});

router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    if (name.length < 2) {
      res.status(400).json({ success: false, error: 'Name must be at least 2 characters' });
      return;
    }
    const user = req.user!;
    user.name = name;
    if (phone) user.phone = phone;
    await user.save();
    res.json({ success: true, user: serializeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Profile update failed' });
  }
});

router.post('/verify-email', async (req, res) => {
  const rawToken = String(req.body.token || '');
  if (!rawToken) {
    res.status(400).json({ success: false, error: 'Verification token required' });
    return;
  }
  const tokenHash = hashToken(rawToken);
  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: { $gt: new Date() },
  });
  if (!user) {
    res.status(400).json({ success: false, error: 'Invalid or expired verification token' });
    return;
  }
  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();
  res.json({ success: true, message: 'Email verified successfully' });
});

router.post('/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email });
  if (user) {
    const { rawToken, tokenHash } = generateOpaqueToken();
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    const resetUrl = `${env.appUrl}/reset-password?token=${rawToken}`;
    await sendTransactionalEmail({
      to: user.email,
      subject: 'NOVARA Password Reset',
      text: `Reset your password: ${resetUrl}`,
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your NOVARA password. Valid for 1 hour.</p>`,
    });
  }
  // Always return generic success to avoid email enumeration
  res.json({
    success: true,
    message: 'If an account exists for this email, a password reset link has been sent.',
  });
});

router.post('/reset-password', async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (!token || password.length < 8) {
    res.status(400).json({ success: false, error: 'Valid token and 8+ character password required' });
    return;
  }
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  });
  if (!user) {
    res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    return;
  }
  user.passwordHash = await hashPassword(password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
  res.json({ success: true, message: 'Password has been reset. You may now sign in.' });
});

// Real Google OAuth flow
router.get('/google', (req, res) => {
  if (!getIntegrationStatus().googleOAuth) {
    res.status(501).json({
      success: false,
      error: 'Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing).',
    });
    return;
  }
  const redirectTo = typeof req.query.redirect === 'string' ? req.query.redirect : '/';
  const state = createSignedOAuthState('google', redirectTo);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.googleOAuth.clientId);
  url.searchParams.set('redirect_uri', env.googleOAuth.callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

router.get('/google/callback', async (req, res) => {
  try {
    if (!getIntegrationStatus().googleOAuth) {
      res.redirect('/login?error=google_oauth_unconfigured');
      return;
    }
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const verifiedState = verifySignedOAuthState(state, 'google');
    if (!code || !verifiedState) {
      res.redirect('/login?error=invalid_oauth_state');
      return;
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.googleOAuth.clientId,
        client_secret: env.googleOAuth.clientSecret,
        redirect_uri: env.googleOAuth.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      res.redirect('/login?error=oauth_token_exchange_failed');
      return;
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as {
      id: string;
      email: string;
      verified_email?: boolean;
      name?: string;
      picture?: string;
    };

    if (!profile.email || !profile.verified_email) {
      res.redirect('/login?error=google_email_unverified');
      return;
    }

    let user = await User.findOne({ 'oauthProviders.googleId': profile.id });
    if (!user) {
      user = await User.findOne({ email: profile.email.toLowerCase() });
      if (user) {
        if (!user.emailVerified) {
          res.redirect('/login?error=account_linking_requires_verified_email');
          return;
        }
        user.oauthProviders.googleId = profile.id;
        await user.save();
      } else {
        user = await User.create({
          name: profile.name || 'NOVARA User',
          email: profile.email.toLowerCase(),
          avatarUrl: profile.picture,
          role: 'customer',
          emailVerified: true,
          oauthProviders: { googleId: profile.id },
        });
      }
    }

    const sessionToken = signSessionToken(user);
    setSessionCookie(res, sessionToken, req);
    res.redirect(verifiedState.redirectTo);
  } catch {
    res.redirect('/login?error=oauth_callback_error');
  }
});

// Real Facebook OAuth flow
router.get('/facebook', (req, res) => {
  if (!getIntegrationStatus().facebookOAuth) {
    res.status(501).json({
      success: false,
      error: 'Facebook OAuth is not configured (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing).',
    });
    return;
  }
  const redirectTo = typeof req.query.redirect === 'string' ? req.query.redirect : '/';
  const state = createSignedOAuthState('facebook', redirectTo);
  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  url.searchParams.set('client_id', env.facebookOAuth.appId);
  url.searchParams.set('redirect_uri', env.facebookOAuth.callbackUrl);
  url.searchParams.set('scope', 'email,public_profile');
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

router.get('/facebook/callback', async (req, res) => {
  try {
    if (!getIntegrationStatus().facebookOAuth) {
      res.redirect('/login?error=facebook_oauth_unconfigured');
      return;
    }
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const verifiedState = verifySignedOAuthState(state, 'facebook');
    if (!code || !verifiedState) {
      res.redirect('/login?error=invalid_oauth_state');
      return;
    }

    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', env.facebookOAuth.appId);
    tokenUrl.searchParams.set('redirect_uri', env.facebookOAuth.callbackUrl);
    tokenUrl.searchParams.set('client_secret', env.facebookOAuth.appSecret);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      res.redirect('/login?error=oauth_token_exchange_failed');
      return;
    }

    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(tokenData.access_token)}`
    );
    const profile = (await profileRes.json()) as { id: string; name?: string; email?: string };
    if (!profile.email) {
      res.redirect('/login?error=facebook_email_required');
      return;
    }

    let user = await User.findOne({ 'oauthProviders.facebookId': profile.id });
    if (!user) {
      user = await User.findOne({ email: profile.email.toLowerCase() });
      if (user) {
        if (!user.emailVerified) {
          res.redirect('/login?error=account_linking_requires_verified_email');
          return;
        }
        user.oauthProviders.facebookId = profile.id;
        await user.save();
      } else {
        user = await User.create({
          name: profile.name || 'NOVARA User',
          email: profile.email.toLowerCase(),
          role: 'customer',
          emailVerified: true,
          oauthProviders: { facebookId: profile.id },
        });
      }
    }

    const sessionToken = signSessionToken(user);
    setSessionCookie(res, sessionToken, req);
    res.redirect(verifiedState.redirectTo);
  } catch {
    res.redirect('/login?error=oauth_callback_error');
  }
});

// Addresses
router.get('/addresses', requireAuth, (req: AuthRequest, res) => {
  res.json({ success: true, addresses: req.user!.addresses });
});

router.post('/addresses', requireAuth, async (req: AuthRequest, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid address' });
    return;
  }
  const user = req.user!;
  if (parsed.data.isDefault || user.addresses.length === 0) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }
  user.addresses.push({ ...parsed.data, isDefault: Boolean(parsed.data.isDefault || user.addresses.length === 0) });
  await user.save();
  res.status(201).json({ success: true, addresses: user.addresses });
});

router.delete('/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;
  user.addresses = user.addresses.filter((a) => String(a._id) !== req.params.id);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
});

// Wishlist
router.get('/wishlist', requireAuth, async (req: AuthRequest, res) => {
  const products = await CanonicalProduct.find({
    _id: { $in: req.user!.wishlistProductIds },
    moderationStatus: 'published',
  })
    .populate('categoryId', 'name slug')
    .populate('brandId', 'name slug')
    .lean();
  const items = await attachBestOffersToProducts(products);
  res.json({ success: true, items });
});

router.post('/wishlist/:productId', requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;
  const pid = req.params.productId;
  const exists = user.wishlistProductIds.some((id) => String(id) === pid);
  if (exists) {
    user.wishlistProductIds = user.wishlistProductIds.filter((id) => String(id) !== pid);
  } else {
    user.wishlistProductIds.push(pid as any);
  }
  await user.save();
  res.json({ success: true, wishlisted: !exists, count: user.wishlistProductIds.length });
});

// Notifications
router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  const notifications = await Notification.find({ recipientUserId: req.user!._id })
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();
  res.json({ success: true, notifications });
});

router.patch('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  await Notification.updateOne(
    { _id: req.params.id, recipientUserId: req.user!._id },
    { $set: { read: true } }
  );
  res.json({ success: true });
});

router.patch('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  await Notification.updateMany({ recipientUserId: req.user!._id }, { $set: { read: true } });
  res.json({ success: true });
});

// Customer/Seller Support Tickets
router.get('/support', requireAuth, async (req: AuthRequest, res) => {
  const tickets = await SupportTicket.find({ creatorUserId: req.user!._id })
    .sort({ updatedAt: -1 })
    .lean();
  res.json({ success: true, tickets });
});

router.post('/support', requireAuth, async (req: AuthRequest, res) => {
  const parsed = supportTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid ticket' });
    return;
  }
  const ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const ticket = await SupportTicket.create({
    ticketNumber,
    creatorUserId: req.user!._id,
    creatorRole: req.user!.role === 'seller' ? 'seller' : 'customer',
    subject: parsed.data.subject,
    category: parsed.data.category,
    priority: parsed.data.priority,
    relatedOrderNumber: parsed.data.relatedOrderNumber,
    status: 'open',
    messages: [
      {
        senderUserId: req.user!._id,
        senderName: req.user!.name,
        senderRole: req.user!.role,
        body: parsed.data.message,
        attachments: [],
      },
    ],
  });
  res.status(201).json({ success: true, ticket });
});

router.post('/support/:id/reply', requireAuth, async (req: AuthRequest, res) => {
  const body = String(req.body.message || '').trim();
  if (body.length < 2) {
    res.status(400).json({ success: false, error: 'Message required' });
    return;
  }
  const ticket = await SupportTicket.findOne({ _id: req.params.id, creatorUserId: req.user!._id });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  ticket.messages.push({
    senderUserId: req.user!._id,
    senderName: req.user!.name,
    senderRole: req.user!.role,
    body,
    attachments: [],
    sentAt: new Date(),
  });
  ticket.status = 'open';
  await ticket.save();
  res.json({ success: true, ticket });
});

export default router;
