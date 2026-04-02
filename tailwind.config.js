/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        tiktok: {
          red: '#FE2C55',
          blue: '#25F4EE',
          dark: '#161823',
          gray: {
            50: '#F8F8F8',
            100: '#F1F1F2',
            200: '#E3E3E4',
            300: '#C4C4C6',
            400: '#A1A1A3',
            500: '#757577',
            600: '#545456',
            700: '#3D3D3F',
            800: '#2C2C2E',
            900: '#1C1C1E',
          },
        },
        brand: {
          primary: '#FE2C55',
          secondary: '#25F4EE',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
