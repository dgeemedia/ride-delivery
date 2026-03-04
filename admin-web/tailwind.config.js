/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F2FF',
          100: '#CCE5FF',
          200: '#99CBFF',
          300: '#66B0FF',
          400: '#3396FF',
          500: '#007AFF',
          600: '#0062CC',
          700: '#004C99',
          800: '#003366',
          900: '#001933',
        },
        secondary: {
          50: '#F0F0FF',
          100: '#E0E0FF',
          500: '#5856D6',
          600: '#4644AD',
          700: '#353384',
        },
        success: {
          50: '#E8F9EC',
          100: '#D1F3D9',
          500: '#34C759',
          600: '#2AA047',
          700: '#1F7935',
        },
        warning: {
          50: '#FFF4E5',
          100: '#FFE9CC',
          500: '#FF9500',
          600: '#CC7700',
          700: '#995900',
        },
        error: {
          50: '#FFE8E6',
          100: '#FFD1CC',
          500: '#FF3B30',
          600: '#CC2F26',
          700: '#99231D',
        },
        gray: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#EEEEEE',
          300: '#E0E0E0',
          400: '#BDBDBD',
          500: '#9E9E9E',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}