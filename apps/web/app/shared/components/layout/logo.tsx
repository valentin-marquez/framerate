import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function Logo({ className, isHovered }: { className?: string; isHovered?: boolean }) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isHovered) {
      setRotation((prev) => prev + 360);
    }
  }, [isHovered]);

  return (
    <motion.svg
      name="Logo Framerate.cl"
      width="448"
      height="448"
      viewBox="0 0 448 448"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <title>Framerate Logo</title>
      <path
        d="M0 5C0 2.24 2.24 0 5 0H135.42C138.18 0 140.42 2.24 140.42 5V442.27C140.42 445.03 138.18 447.27 135.42 447.27H5C2.24 447.27 0 445.03 0 442.27V5Z"
        fill="currentColor"
      />
      <path
        d="M442.27 0C445.03 0 447.27 2.24 447.27 5V135.42C447.27 138.18 445.03 140.42 442.27 140.42H5C2.24 140.42 0 138.18 0 135.42L0 5C0 2.24 2.24 0 5 0H442.27Z"
        fill="currentColor"
      />
      <path
        d="M162 209.042C162 206.278 164.239 204.037 167 204.037H304.8C307.561 204.037 309.8 206.278 309.8 209.042V441.995C309.8 444.759 307.561 447 304.8 447H167C164.239 447 162 444.759 162 441.995V209.042Z"
        fill="currentColor"
      />
      <path
        d="M442 170C444.761 170 447 172.241 447 175.005V307.147C447 309.912 444.761 312.153 442 312.153H167C164.239 312.153 162 309.912 162 307.147V175.005C162 172.241 164.239 170 167 170H442Z"
        fill="currentColor"
      />
      <motion.rect
        x="339"
        y="339"
        width="108"
        height="108"
        rx="5"
        fill="currentColor"
        animate={{ rotate: rotation }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </motion.svg>
  );
}
