import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { inr, duration } from '../lib/format';

export const Thumb = ({ course, className = '' }) => {
  const [broken, setBroken] = useState(false);
  return course.thumbnail && !broken
    ? <img src={course.thumbnail} alt="" loading="lazy" onError={() => setBroken(true)} className={`aspect-video w-full rounded-field object-cover ${className}`} />
    : <div className={`grid aspect-video w-full place-items-center rounded-field bg-board font-display text-3xl font-bold text-chalk ${className}`}>{course.title[0]}</div>;
};

export default function CourseRow({ course }) {
  return (
    <article className="grid gap-4 border-b border-line py-5 sm:grid-cols-[200px_1fr_auto]">
      <Link to={`/courses/${course.slug}`} aria-hidden tabIndex={-1}><Thumb course={course} /></Link>
      <div>
        <h3 className="text-lg font-bold leading-snug"><Link to={`/courses/${course.slug}`} className="hover:text-board hover:underline">{course.title}</Link></h3>
        <p className="mt-1 text-sm text-ink-mute">{course.instructorName}</p>
        <p className="mt-2 line-clamp-2 max-w-prose text-sm">{course.description}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="tag">{course.category}</span>
          <span className="tag">{course.level}</span>
          <span className="tag">{course.lessonCount} lessons{course.totalDurationSec ? `, ${duration(course.totalDurationSec)}` : ''}</span>
          <span className="tag">{course.enrolledCount} enrolled</span>
        </div>
      </div>
      <div className="font-display text-xl font-bold sm:text-right">{inr(course.price)}</div>
    </article>
  );
}
