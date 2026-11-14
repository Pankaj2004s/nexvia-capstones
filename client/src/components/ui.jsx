import React from 'react';

export const Spinner = ({ label = 'Loading…' }) => <div className="py-16 text-center text-ink-mute" role="status">{label}</div>;

export const Empty = ({ title, children }) => (
  <div className="panel px-6 py-12 text-center">
    <p className="font-display text-lg font-bold">{title}</p>
    {children && <div className="mt-2 text-sm text-ink-mute">{children}</div>}
  </div>
);

export const ProgressBar = ({ value, className = '' }) => (
  <div className={`h-2 overflow-hidden rounded-full bg-line ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full bg-board transition-[width]" style={{ width: `${value}%` }} />
  </div>
);

export const ErrorNote = ({ children }) => children ? <p role="alert" className="rounded-field border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral">{children}</p> : null;

export function Field({ label, id, ...props }) {
  return (<div><label htmlFor={id} className="label">{label}</label><input id={id} className="field" {...props} /></div>);
}
