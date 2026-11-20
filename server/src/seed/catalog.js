// Demo content used by the seed script and by the optional boot-time seeding.
const PASSWORD = 'Demo@1234';

// title, category, level, price (INR), tags, short label used on the thumbnail
const CATALOG = [
  ['Complete Node.js & Express Bootcamp', 'Backend', 'intermediate', 1499, ['node', 'express', 'api'], 'Node.js'],
  ['React 19 from Zero to Hero', 'Frontend', 'beginner', 1299, ['react', 'hooks'], 'React'],
  ['MongoDB & Mongoose Mastery', 'Database', 'intermediate', 999, ['mongodb', 'mongoose'], 'MongoDB'],
  ['JavaScript: The Complete Guide', 'Programming', 'beginner', 0, ['javascript', 'es6'], 'JavaScript'],
  ['TypeScript for Professionals', 'Programming', 'advanced', 1199, ['typescript'], 'TypeScript'],
  ['Docker & Deployment Essentials', 'DevOps', 'intermediate', 899, ['docker', 'deploy'], 'Docker'],
  ['Data Structures in JavaScript', 'Computer Science', 'intermediate', 0, ['dsa', 'algorithms'], 'DSA'],
  ['Tailwind CSS: Design Systems', 'Frontend', 'beginner', 599, ['css', 'tailwind'], 'Tailwind'],
  ['Python for Data Analysis', 'Data Science', 'beginner', 1099, ['python', 'pandas'], 'Python'],
  ['System Design Fundamentals', 'Architecture', 'advanced', 1999, ['design', 'scale'], 'System Design'],
  ['Git & GitHub Workflow', 'Tools', 'beginner', 0, ['git', 'github'], 'Git'],
  ['WebRTC & Real-time Apps', 'Backend', 'advanced', 1699, ['webrtc', 'sockets'], 'WebRTC'],
];

const SECTIONS = {
  Basics: ['Welcome and course roadmap', 'Setting up your environment', 'Core concepts explained'],
  Building: ['Project structure', 'Implementing the main feature', 'Handling errors and edge cases'],
  Shipping: ['Testing your work', 'Deploying to production'],
};

const quizFor = (title) => ({
  title: `${title.split(':')[0]} quick check`,
  passingPercent: 60,
  questions: [
    { text: 'Which HTTP method is normally used to create a resource?', type: 'single', options: [{ text: 'GET' }, { text: 'POST', isCorrect: true }, { text: 'DELETE' }], points: 1 },
    { text: 'Which of these are valid HTTP status codes for success?', type: 'multi', options: [{ text: '200', isCorrect: true }, { text: '201', isCorrect: true }, { text: '404' }], points: 2 },
    { text: 'JSON stands for JavaScript Object Notation.', type: 'truefalse', options: [{ text: 'True', isCorrect: true }, { text: 'False' }], points: 1 },
  ],
});

// the file name of a course thumbnail in client/public/thumbs
const thumbName = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

module.exports = { PASSWORD, CATALOG, SECTIONS, quizFor, thumbName };
