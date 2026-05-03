import * as React from "react";

/**
 * Instagram glyph as a self-contained SVG.
 *
 * lucide-react removed Instagram (and other social-network marks) over
 * trademark concerns, so we ship our own minimal stroke version that
 * matches Lucide's visual weight and accepts the standard `className` /
 * `size` props.
 */
export function InstagramGlyph({
  className,
  size = 16,
  strokeWidth = 2,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
