import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cnci: {
          blue: '#2563eb',
          dark: '#1e40af',
          navy: '#004aad',
          'navy-deep': '#002d69',
          accent: '#ff8500',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        premium: '0 20px 50px -12px rgba(0,74,173,0.12)',
        'premium-hover': '0 25px 60px -12px rgba(0,74,173,0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
