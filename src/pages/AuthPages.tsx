import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ShoppingBag } from 'lucide-react';
import { AppDispatch } from '../store';
import { setAuthSession } from '../store/authSlice';
import { hydrateCart } from '../store/cartSlice';
import { pushToast } from '../store/uiSlice';
import { apiRequest, setAuthToken } from '../lib/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const redirect = searchParams.get('redirect') || '/';
  const oauthError = searchParams.get('error');

  useEffect(() => {
    if (oauthError) {
      dispatch(pushToast({ type: 'error', title: 'OAuth Sign-In Notice', message: oauthError.replace(/_/g, ' ') }));
    }
  }, [oauthError, dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.token) setAuthToken(res.token);
      dispatch(
        setAuthSession({
          user: res.user,
          sellerStore: res.sellerStore,
          sellerApplication: res.sellerApplication,
        })
      );
      await dispatch(hydrateCart());
      dispatch(pushToast({ type: 'success', title: `Welcome back, ${res.user.name}` }));
      navigate(redirect);
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Sign in failed', message: err.message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-10 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="text-center">
          <div className="w-11 h-11 rounded-xl bg-[#0D63F3] text-white flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Sign In to NOVARA</h1>
          <p className="text-xs text-slate-500 mt-1">Access your orders, wishlist, seller store, or admin console</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
                Password
              </label>
              <Link to="/forgot-password" className="text-[11px] font-semibold text-[#0D63F3] hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-sm font-bold cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <a
            href={`/api/auth/google?redirect=${encodeURIComponent(redirect)}`}
            className="h-10 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center"
          >
            Google Sign-In
          </a>
          <a
            href={`/api/auth/facebook?redirect=${encodeURIComponent(redirect)}`}
            className="h-10 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center"
          >
            Facebook Sign-In
          </a>
        </div>

        <p className="text-center text-xs text-slate-600">
          New to NOVARA?{' '}
          <Link to="/register" className="font-bold text-[#0D63F3] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password }),
      });
      if (res.token) setAuthToken(res.token);
      dispatch(setAuthSession({ user: res.user, sellerStore: null, sellerApplication: null }));
      await dispatch(hydrateCart());
      dispatch(
        pushToast({
          type: 'success',
          title: 'Account Created',
          message: res.devVerificationToken
            ? 'Welcome! Email verification token generated in dev mode.'
            : 'Welcome to NOVARA! Please verify your email.',
        })
      );
      navigate('/account');
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Registration Failed', message: err.message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-10 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900">Create NOVARA Account</h1>
          <p className="text-xs text-slate-500 mt-1">Shop across verified Bangladesh stores</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              id="reg-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
            />
          </div>
          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
            />
          </div>
          <div>
            <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
              Bangladesh Mobile Number
            </label>
            <input
              id="reg-phone"
              required
              placeholder="017XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
            />
          </div>
          <div>
            <label htmlFor="reg-pass" className="block text-xs font-semibold text-slate-700 mb-1">
              Password (8+ characters)
            </label>
            <input
              id="reg-pass"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-sm font-bold cursor-pointer"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-[#0D63F3] hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const dispatch = useDispatch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
      dispatch(pushToast({ type: 'info', title: 'Reset Link Sent', message: res.message }));
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.message }));
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4">
        <h1 className="text-lg font-bold text-slate-900">Reset Your Password</h1>
        {sent ? (
          <p className="text-xs text-slate-600">
            If an account exists for <strong>{email}</strong>, check your inbox for password reset instructions.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm"
            />
            <button type="submit" className="w-full h-10 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
              Send Reset Link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      dispatch(pushToast({ type: 'success', title: 'Password Updated' }));
      navigate('/login');
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Reset failed', message: err.message }));
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h1 className="text-lg font-bold text-slate-900">Choose New Password</h1>
        <input
          type="password"
          required
          minLength={8}
          placeholder="New password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm"
        />
        <button type="submit" className="w-full h-10 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
          Update Password
        </button>
      </form>
    </div>
  );
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setStatus('Missing verification token.');
      return;
    }
    apiRequest('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => setStatus('Your email is now verified!'))
      .catch((err) => setStatus(err.message || 'Verification failed.'));
  }, [token]);

  return (
    <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Email Verification</h1>
      <p className="text-sm text-slate-600">{status}</p>
      <Link to="/account" className="inline-block px-5 py-2 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
        Go to Account
      </Link>
    </div>
  );
}
