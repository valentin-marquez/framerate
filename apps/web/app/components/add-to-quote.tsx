import { Check, ReceiptText, X } from "lucide-react";
import {
	AnimatePresence,
	MotionConfig,
	motion,
	type Transition,
} from "motion/react";
import { useRef, useState } from "react";
import useClickOutside from "@/hooks/useClickOutside";
import { cn } from "@/lib/utils";
import type { Product } from "@/utils/db-types";
import { Button } from "./primitives/button";

interface AddToQuoteProps {
	product: Product;
	className?: string;
}

const transition: Transition = {
	type: "spring",
	bounce: 0.1,
	duration: 0.25,
};

export function AddToQuote({ product, className }: AddToQuoteProps) {
	const [isOpen, setIsOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useClickOutside(ref, () => setIsOpen(false));

	return (
		<MotionConfig transition={transition}>
			<div className={cn("relative h-10 w-12", className)} ref={ref}>
				<AnimatePresence initial={false} mode="popLayout">
					{!isOpen ? (
						<motion.button
							layoutId={`add-to-quote-${product.id}`}
							className="flex h-10 w-12 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
							onClick={() => setIsOpen(true)}
							aria-label="Agregar a cotización"
							type="button"
						>
							<motion.span
								layoutId={`icon-${product.id}`}
								exit={{ opacity: 0, transition: { duration: 0.1 } }}
							>
								<ReceiptText className="h-4 w-4" />
							</motion.span>
						</motion.button>
					) : (
						<motion.div
							layoutId={`add-to-quote-${product.id}`}
							className="absolute bottom-0 right-0 z-20 w-[260px] overflow-hidden rounded-lg border border-border bg-card shadow-xl"
						>
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2, delay: 0.1 }}
							>
								<div className="flex items-center justify-between border-b border-border bg-muted/30 p-2">
									<span className="text-xs font-medium text-foreground px-1">
										Agregar a cotización
									</span>
									<button
										type="button"
										className={cn(
											"flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors",
											"hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] cursor-pointer",
										)}
										onClick={(e) => {
											e.stopPropagation();
											setIsOpen(false);
										}}
									>
										<X className="h-3.5 w-3.5" />
									</button>
								</div>

								<div className="p-3 space-y-3">
									<div className="space-y-1.5">
										<label
											htmlFor="quote-select"
											className="text-xs font-medium text-muted-foreground"
										>
											Seleccionar cotización
										</label>
										<select
											id="quote-select"
											className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										>
											<option value="">Seleccionar...</option>
											<option value="1">Mi PC Gamer</option>
											<option value="2">Workstation Edición</option>
											<option value="3">Streaming Setup</option>
										</select>
									</div>

									<Button
										className="w-full h-8 text-xs font-medium"
										onClick={() => setIsOpen(false)}
									>
										<Check className="mr-2 h-3.5 w-3.5" />
										Confirmar
									</Button>
								</div>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</MotionConfig>
	);
}
