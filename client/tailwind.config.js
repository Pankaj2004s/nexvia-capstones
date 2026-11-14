/** Design tokens: a school-board palette (blackboard green, chalk yellow, exam-sheet grey). */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        board: { DEFAULT: '#0E4B45', deep: '#093631', soft: '#1B6A62' },
        chalk: { DEFAULT: '#F4C430', soft: '#FBE9A8' },
        ink: { DEFAULT: '#172026', mute: '#5B6770' },
        paper: { DEFAULT: '#F3F5F7', white: '#FFFFFF' },
        line: '#D5DCE0',
        coral: '#D9482B',
        ok: '#1F7A4D',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
        body: ['"Public Sans Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { field: '6px', panel: '14px' },
    },
  },
  plugins: [],
};
