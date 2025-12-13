import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function Logo({
	className,
	isHovered,
}: {
	className?: string;
	isHovered?: boolean;
}) {
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
				d="M0 5C0 2.23858 2.23858 0 5 0H135.421C138.182 0 140.421 2.23858 140.421 5V442.266C140.421 445.028 138.182 447.266 135.421 447.266H5C2.23857 447.266 0 445.028 0 442.266V5Z"
				fill="currentColor"
			/>
			<path
				d="M442.267 0C445.028 0 447.267 2.23858 447.267 5V135.421C447.267 138.182 445.028 140.421 442.267 140.421H5.00037C2.23895 140.421 0.000366211 138.182 0.000366211 135.421L0 5C0 2.23858 2.23858 0 5 0H442.267Z"
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
