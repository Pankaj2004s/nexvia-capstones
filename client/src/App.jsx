import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { bootstrapAuth } from './app/slices';
import Layout from './components/Layout.jsx';
import { RequireAuth } from './components/Guards.jsx';
import Home from './pages/Home.jsx';
import { Login, Register } from './pages/Auth.jsx';
const CourseDetail = lazy(() => import('./pages/CourseDetail.jsx'));
const Learn = lazy(() => import('./pages/Learn.jsx'));
const Quiz = lazy(() => import('./pages/Quiz.jsx'));
const LiveRoom = lazy(() => import('./pages/LiveRoom.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Instructor = lazy(() => import('./pages/Instructor.jsx'));
const CourseEditor = lazy(() => import('./pages/CourseEditor.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Verify = lazy(() => import('./pages/Verify.jsx'));
import NotFound from './pages/NotFound.jsx';

export default function App() {
  const dispatch = useDispatch();
  const ready = useSelector((s) => s.auth.ready);
  useEffect(() => { dispatch(bootstrapAuth()); }, [dispatch]);
  if (!ready) return <div className="grid min-h-screen place-items-center text-ink-mute">Loading LearnSphere…</div>;

  return (
    <Suspense fallback={<div className="py-24 text-center text-ink-mute">Loading…</div>}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/courses/:slug" element={<CourseDetail />} />
        <Route path="/verify/:certId" element={<Verify />} />
        <Route path="/learn/:courseId" element={<RequireAuth><Learn /></RequireAuth>} />
        <Route path="/quiz/:quizId" element={<RequireAuth><Quiz /></RequireAuth>} />
        <Route path="/live/:classId" element={<RequireAuth><LiveRoom /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/instructor" element={<RequireAuth roles={['instructor', 'admin']}><Instructor /></RequireAuth>} />
        <Route path="/instructor/courses/:courseId" element={<RequireAuth roles={['instructor', 'admin']}><CourseEditor /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth roles={['admin']}><Admin /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
