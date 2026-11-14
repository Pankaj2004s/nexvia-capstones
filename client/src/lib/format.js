export const inr = (n) => (n > 0 ? `₹${Number(n).toLocaleString('en-IN')}` : 'Free');
export const duration = (sec) => {
  if (!sec) return '';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
export const dateTime = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export const groupBy = (items, key) => items.reduce((acc, it) => { (acc[it[key]] ||= []).push(it); return acc; }, {});
