/** Logotipo de Sure Developments (misma figura que Logo.astro). */
export default function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Sure Developments">
      <defs>
        <linearGradient id="sd-grad-r" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0b1f4d" />
          <stop offset="0.55" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path d="M24 2.5 42.6 13.25v21.5L24 45.5 5.4 34.75v-21.5Z" fill="url(#sd-grad-r)" />
      <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 17.5 12 24l5.5 6.5" />
        <path d="M30.5 17.5 36 24l-5.5 6.5" />
        <path d="M21 31.5 26.4 16.8" />
      </g>
      <circle cx="27.6" cy="13.4" r="2.3" fill="#7dd3fc" />
    </svg>
  );
}
