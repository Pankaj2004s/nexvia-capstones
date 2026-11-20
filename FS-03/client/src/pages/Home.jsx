import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCourses } from '../app/slices';
import CourseRow from '../components/CourseRow.jsx';
import { Spinner, Empty } from '../components/ui.jsx';
import { inr } from '../lib/format';

const CATEGORIES = ['Backend', 'Frontend', 'Database', 'Programming', 'DevOps', 'Computer Science', 'Data Science', 'Architecture', 'Tools'];

export default function Home() {
  const dispatch = useDispatch();
  const { items, page, pages, total, status, error } = useSelector((s) => s.catalog);
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const params = { q: sp.get('q') || '', category: sp.get('category') || '', level: sp.get('level') || '', maxPrice: sp.get('maxPrice') || '', sort: sp.get('sort') || 'newest', page: sp.get('page') || 1, limit: 8 };

  useEffect(() => { dispatch(fetchCourses(params)); }, [dispatch, sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setSp(n); };
  const newest = items.slice(0, 4);

  return (
    <>
      <section className="bg-board text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.05] md:text-6xl">Pick a course. Show up to class.</h1>
            <p className="mt-5 max-w-md text-lg text-white/80">Video lessons you can finish, live classes you can join, quizzes that grade themselves, and a certificate with your name on it.</p>
            <form className="mt-8 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }} role="search">
              <input value={q} onChange={(e) => setQ(e.target.value)} className="field border-transparent text-ink" placeholder="Search courses, e.g. React" aria-label="Search courses" />
              <button className="btn-chalk">Search</button>
            </form>
          </div>
          <div className="rounded-panel border border-white/15 bg-board-deep p-5" aria-label="Newest courses">
            <p className="font-display text-sm font-semibold text-chalk">On the board now</p>
            <ul className="mt-3 divide-y divide-white/10">
              {newest.length === 0 && <li className="py-3 text-sm text-white/60">{status === 'loading' ? 'Loading…' : 'No courses published yet.'}</li>}
              {newest.map((c) => (
                <li key={c.id}>
                  <Link to={`/courses/${c.slug}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-chalk">
                    <span className="font-display text-lg font-semibold leading-tight">{c.title}</span>
                    <span className="shrink-0 text-sm text-chalk">{inr(c.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[220px_1fr]">
        <aside aria-label="Filters" className="space-y-5">
          <div>
            <label htmlFor="cat" className="label">Category</label>
            <select id="cat" className="field" value={params.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="lvl" className="label">Level</label>
            <select id="lvl" className="field" value={params.level} onChange={(e) => set('level', e.target.value)}>
              <option value="">Any level</option>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label htmlFor="price" className="label">Price</label>
            <select id="price" className="field" value={params.maxPrice} onChange={(e) => set('maxPrice', e.target.value)}>
              <option value="">Any price</option><option value="0">Free only</option><option value="1000">Up to ₹1,000</option><option value="1500">Up to ₹1,500</option>
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="label">Sort by</label>
            <select id="sort" className="field" value={params.sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="newest">Newest</option><option value="popular">Most enrolled</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
            </select>
          </div>
          {(params.q || params.category || params.level || params.maxPrice) && <button className="btn-ghost w-full" onClick={() => { setQ(''); setSp({}); }}>Clear filters</button>}
        </aside>

        <section aria-live="polite">
          <p className="text-sm text-ink-mute">{status === 'ready' ? `${total} course${total === 1 ? '' : 's'}` : ' '}</p>
          {status === 'loading' && items.length === 0 && <Spinner />}
          {status === 'error' && <Empty title="Couldn’t load courses">{error}. Check that the API is running, then reload.</Empty>}
          {status === 'ready' && items.length === 0 && <Empty title="No courses match these filters">Try a different search or <button className="underline" onClick={() => { setQ(''); setSp({}); }}>clear the filters</button>.</Empty>}
          <div>{items.map((c) => <CourseRow key={c.id} course={c} />)}</div>
          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => set('page', String(page - 1))}>Previous</button>
              <span className="text-sm text-ink-mute">Page {page} of {pages}</span>
              <button className="btn-ghost" disabled={page >= pages} onClick={() => set('page', String(page + 1))}>Next</button>
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
