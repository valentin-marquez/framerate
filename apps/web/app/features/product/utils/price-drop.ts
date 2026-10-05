/** Baja que vale la pena mostrar: 3% o más bajo el precio habitual (menos que eso es ruido entre días). */
export function priceDrop(price: number | null, reference: number | null) {
  if (!price || !reference || price > reference * 0.97) return null;
  return { amount: reference - price, percent: Math.round((1 - price / reference) * 100) };
}
