import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../app/slices';
import Toasts from './Toasts.jsx';

const linkCls = ({ isActive }) => `rounded-field px-3 py-2 text-sm font-medium ${isActive ? 'bg-board text-white' : 'text-ink hover:bg-white'}`;

export default function Layout() {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-paper-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/" className="mr-4 font-display text-xl font-extrabold tracking-tight text-board">LearnSphere</Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1" aria-label="Main">
            <NavLink to="/" end className={linkCls}>Courses</NavLink>
            {user && <NavLink to="/dashboard" className={linkCls}>My learning</NavLink>}
            {user && ['instructor', 'admin'].includes(user.role) && <NavLink to="/instructor" className={linkCls}>Teach</NavLink>}
            {user && user.role === 'admin' && <NavLink to="/admin" className={linkCls}>Admin</NavLink>}
          </nav>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-ink-mute sm:inline">{user.name} <span className="tag ml-1">{user.role}</span></span>
              <button className="btn-ghost" onClick={async () => { await dispatch(logout()); navigate('/'); }}>Log out</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-ghost">Log in</Link>
              <Link to="/register" className="btn-primary">Create account</Link>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-line py-6 text-center text-sm text-ink-mute">LearnSphere, an online school with live classes.</footer>
      <Toasts />
    </div>
  );
}
