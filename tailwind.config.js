/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cube: {
          U: '#f5f5f5',  // white (up)
          D: '#ffd500',  // yellow (down)
          F: '#009b48',  // green (front)
          B: '#0046ad',  // blue (back)
          L: '#ff5900',  // orange (left)
          R: '#b71234',  // red (right)
          bg: '#0a0a14',
          panel: '#13131f',
          border: '#2a2a3a',
          text: '#e8e8f0',
          muted: '#8a8a9c',
          accent: '#7c5cff',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
