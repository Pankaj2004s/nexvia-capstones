import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { dismissToast } from '../app/slices';

function Toast({ t }) {
  const dispatch = useDispatch();
  useEffect(() => { const id = setTimeout(() => dispatch(dismissToast(t.id)), 4500); return () => clearTimeout(id); }, [dispatch, t.id]);
  const tone = t.kind === 'error' ? 'bg-coral text-white' : t.kind === 'success' ? 'bg-ok text-white' : 'bg-ink text-white';
  return <div role="status" className={`rounded-field px-4 py-3 text-sm shadow-lg ${tone}`}>{t.message}</div>;
}

export default function Toasts() {
  const toasts = useSelector((s) => s.ui.toasts);
  return <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" aria-live="polite">{toasts.map((t) => <Toast key={t.id} t={t} />)}</div>;
}
