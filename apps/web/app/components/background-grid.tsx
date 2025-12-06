export function BackgroundGrid() {
  return (
    <svg
      className="fixed inset-0 z-[-1] h-full w-full pointer-events-none text-muted-foreground"
      aria-hidden="true"
    >
      <defs>
        <pattern id="grid-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
          <g opacity="0.25">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 11H11V12H12V11ZM12 23H11V24H12V23ZM11 35H12V36H11V35ZM12 47H11V48H12V47ZM23 11H24V12H23V11ZM24 23H23V24H24V23ZM23 35H24V36H23V35ZM24 47H23V48H24V47ZM35 11H36V12H35V11ZM36 23H35V24H36V23ZM35 35H36V36H35V35ZM36 47H35V48H36V47ZM47 11H48V12H47V11ZM48 23H47V24H48V23ZM47 35H48V36H47V35ZM48 47H47V48H48V47Z"
              fill="currentColor"
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </svg>
  );
}
