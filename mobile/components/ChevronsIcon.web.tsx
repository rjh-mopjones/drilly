/**
 * The Drill mark: three stacked chevrons, the same path as the app icon
 * (scripts/build-app-icons.sh, CHEVRONS). Inline SVG so it takes any colour
 * and stays crisp at every size.
 */
export function ChevronsIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path
        d="M22 18 L50 36 L78 18 M22 40 L50 58 L78 40 M22 62 L50 80 L78 62"
        fill="none"
        stroke={color}
        strokeWidth={13}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
