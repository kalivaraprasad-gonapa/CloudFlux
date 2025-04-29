/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./pages/**/*.{js,ts,jsx,tsx}",
      "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: {
            DEFAULT: '#0078d4',
            dark: '#106ebe',
            light: '#2b88d8',
          },
          secondary: {
            DEFAULT: '#f3f3f3',
            dark: '#e1e1e1',
          },
          success: {
            DEFAULT: '#0b8043',
            light: '#34a853',
          },
          error: {
            DEFAULT: '#d93025',
            light: '#ea4335',
          },
        },
        animation: {
          'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }
      },
    },
    plugins: [],
  };