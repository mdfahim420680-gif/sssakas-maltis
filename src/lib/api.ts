const AUTH_TOKEN_KEY = 'novara_auth_token';

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null | undefined): void {
  try {
    if (!token) {
      clearAuthToken();
      return;
    }
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      'Unable to reach server. Please ensure the backend service is running and try again.',
      0
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(
      res.ok ? 'Unexpected non-JSON response from server' : `Request failed (${res.status})`,
      res.status || 500
    );
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.success === false) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status || 500);
  }
  return data as T;
}

export function formatBDT(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en-US')}`;
}
