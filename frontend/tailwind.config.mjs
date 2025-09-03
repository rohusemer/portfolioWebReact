/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',       // Brighter Blue
        accent: '#059669',        // Richer Emerald
        'light-text': '#e6edf3',   // Light Gray (for dark mode)
        'dark-text': '#111827',    // Almost Black (for light mode)
        'light-bg': '#f9fafb',     // Off-White
        'dark-bg': '#0d1117',      // Charcoal Black
      },
      backdropBlur: {
        'glass': '16px',
      },
      backgroundColor: {
        // More subtle background, relying on the blur for the effect
        'glass': 'rgba(255, 255, 255, 0.05)', 
      },
      borderColor: {
        'glass': 'rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
}
