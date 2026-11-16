import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

export function ProtectedRoute({
  children,
  roles,
  requireSellerStore = false,
}: {
  children: React.ReactNode;
  roles?: string[];
  requireSellerStore?: boolean;
}) {
  const { user, sellerStore, initialized } = useSelector((s: RootState) => s.auth);
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-slate-500">
        Verifying session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (roles && user.role !== 'super_admin' && !roles.includes(user.role)) {
    return (
      <div className="max-w-lg mx-auto my-16 p-6 bg-white rounded-2xl border border-slate-200 text-center">
        <h1 className="text-lg font-bold text-slate-900">Access Restricted</h1>
        <p className="text-sm text-slate-600 mt-1">
          Your account role ({user.role}) does not have permission to view this area.
        </p>
      </div>
    );
  }

  if (requireSellerStore && (!sellerStore || sellerStore.status !== 'active')) {
    return <Navigate to="/become-a-seller" replace />;
  }

  return <>{children}</>;
}
