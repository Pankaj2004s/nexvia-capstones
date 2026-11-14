import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

// Redirects to /login (remembering where the user wanted to go) and blocks wrong roles.
export function RequireAuth({ roles, children }) {
  const user = useSelector((s) => s.auth.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) {
    return <div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="text-2xl font-bold">You don’t have access to this page</h1><p className="mt-2 text-ink-mute">This area is for {roles.join(' / ')} accounts.</p></div>;
  }
  return children;
}
