/**
 * Tipos Comunes para Normalizadores de Títulos
 *
 * Define las interfaces y tipos utilizados por todos los normalizadores.
 */

export type CategorySlug =
	| "gpu"
	| "cpu"
	| "psu"
	| "motherboard"
	| "case"
	| "ram"
	| "hdd"
	| "ssd"
	| "case_fan"
	| "cpu_cooler";

export interface BrandModel {
	brand: string;
	model: string;
}

export interface NormalizerContext {
	title: string;
	mpn?: string;
	manufacturer?: string;
}
