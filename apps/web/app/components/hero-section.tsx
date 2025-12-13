import { Search } from "lucide-react";
import { Button } from "./primitives/button";

export function HeroSection() {
	return (
		<section className="relative flex flex-col items-center justify-center py-20 md:py-32 text-center space-y-8 overflow-hidden">
			{/* Background decoration */}
			<div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,var(--color-primary)_0%,transparent_70%)] opacity-5" />

			<div className="container px-4 md:px-6 flex flex-col items-center space-y-6 ">
				<h1 className="text-4xl md:text-6xl font-bold tracking-tighter max-w-4xl text-balance">
					Encuentra el mejor precio para tu próximo PC en Chile.
				</h1>

				<p className="text-muted-foreground text-lg md:text-xl max-w-[600px] text-balance">
					Compara precios de miles de componentes de hardware en las mejores
					tiendas del país.
				</p>

				<div className="w-full max-w-2xl relative pt-4">
					{/* TODO: Implement real search functionality */}
					<div className="relative flex items-center group">
						<Search className="absolute left-4 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
						<input
							type="text"
							placeholder="Buscar productos (ej: RTX 4060, Ryzen 5 7600X)..."
							className="w-full h-14 pl-12 pr-32 rounded-full border border-input bg-background shadow-sm hover:shadow-md focus:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg"
						/>
						<div className="absolute right-2">
							<Button size="lg" className="rounded-full px-6 h-10">
								Buscar
							</Button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
