import { React } from "../react";

/** Glifo do app: calendário com nota musical. Usado no título (a versão do manifest é a mesma desenhada em 24×24). */
export function AppIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.2" y="4.8" width="17.6" height="16" rx="4.2" />
      <path d="M8 2.6v3.6M16 2.6v3.6M3.4 9.8h17.2" />
      <circle cx="10.4" cy="16.6" r="1.75" fill="currentColor" stroke="none" />
      <path d="M12.15 16.6v-4.7l3.4 1.3" />
    </svg>
  );
}

export function GlobeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.600 18.500 12 21c-2.600-2.500-3.900-5.500-3.900-9S9.400 5.500 12 3Z" />
    </svg>
  );
}

export function ChevronIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.500" />
    </svg>
  );
}
