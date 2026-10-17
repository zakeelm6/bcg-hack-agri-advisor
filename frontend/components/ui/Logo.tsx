// The Sanabils mark: an ear of wheat (sanabil = ears of grain) in a round cream field. One component for the header, the
// landing page and the install screen, so the brand is drawn once.
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <circle cx="32" cy="32" r="32" fill="#F6EAD4" />
      <g fill="none" stroke="#31572C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 54V26" />
        <path d="M32 26c-7 0-11-4-11-11 7 0 11 4 11 11zM32 26c7 0 11-4 11-11-7 0-11 4-11 11zM32 35c-7 0-11-4-11-11 7 0 11 4 11 11zM32 35c7 0 11-4 11-11-7 0-11 4-11 11zM32 44c-7 0-11-4-11-11 7 0 11 4 11 11zM32 44c7 0 11-4 11-11-7 0-11 4-11 11z" />
        <path d="M32 10v6" />
      </g>
      <path d="M32 26c-7 0-11-4-11-11 7 0 11 4 11 11zM32 26c7 0 11-4 11-11-7 0-11 4-11 11zM32 35c-7 0-11-4-11-11 7 0 11 4 11 11zM32 35c7 0 11-4 11-11-7 0-11 4-11 11zM32 44c-7 0-11-4-11-11 7 0 11 4 11 11zM32 44c7 0 11-4 11-11-7 0-11 4-11 11z" fill="#C8972B" fillOpacity=".55" />
    </svg>
  );
}
