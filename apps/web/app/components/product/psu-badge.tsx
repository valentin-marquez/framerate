import { cn } from "~/lib/utils";

function PsuBadge({ certification }: { certification: string }) {
  const certLower = certification.toLowerCase();

  if (!certLower.includes("80 plus") && !certLower.includes("80plus") && !certLower.includes("80+")) return null;

  // Detectar nivel de certificación
  let level = "standard";
  if (certLower.includes("titanium")) level = "titanium";
  else if (certLower.includes("platinum") || certLower.includes("Platinum")) level = "platinum";
  else if (certLower.includes("gold")) level = "gold";
  else if (certLower.includes("silver")) level = "silver";
  else if (certLower.includes("bronze") || certLower.includes("bronce")) level = "bronze";

  // Estilos Metálicos (Gradient simulando brillo)
  // Usamos 'from' (sombra), 'via' (brillo), 'to' (sombra) en diagonal
  // Bronce: Marrón oscuro -> Cobre brillante -> Marrón oscuro
  // Plata: Gris medio -> Blanco/Plata -> Gris medio
  // Oro: Dorado oscuro -> Amarillo pálido (brillo) -> Dorado ocre
  // Platino: Gris metálico -> Blanco puro -> Gris metálico
  // Titanio: Gris casi negro -> Gris medio -> Gris casi negro
  const styles: Record<string, string> = {
    standard: "bg-white border-gray-300 text-black",
    bronze:
      "bg-gradient-to-br from-[#6d3e18] via-[#d68c45] to-[#6d3e18] border-[#4a280d]/60 text-white shadow-orange-900/20",
    silver:
      "bg-gradient-to-br from-[#7f7f7f] via-[#e8e8e8] to-[#7f7f7f] border-[#595959]/60 text-black shadow-gray-500/20",
    gold: "bg-gradient-to-br from-[#b5862d] via-[#fbf5b7] to-[#aa771c] border-[#8a621a]/60 text-black shadow-yellow-600/20",
    platinum:
      "bg-gradient-to-br from-[#5e5e5e] via-[#ffffff] to-[#5e5e5e] border-[#404040]/60 text-black shadow-gray-400/20",
    titanium:
      "bg-gradient-to-br from-[#1a1a1a] via-[#5a5a5a] to-[#1a1a1a] border-[#000000]/60 text-white shadow-black/40",
  };

  const currentStyle = styles[level] || styles.standard;
  const isDarkText = level === "standard" || level === "silver" || level === "gold" || level === "platinum";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "w-10.5 h-12.5 rounded-lg border shadow-sm select-none z-20",
        "font-sans font-bold leading-none transition-transform",
        currentStyle,
      )}
      title={certification}
    >
      <span
        className={cn(
          "text-[1.1rem] tracking-tighter",
          isDarkText ? "drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]" : "drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]",
        )}
      >
        80
      </span>

      <span className={cn("text-[0.5rem] -mt-0.50", isDarkText ? "text-primary/80" : "text-primary-foreground")}>
        PLUS
      </span>

      <span
        className={cn(
          "text-[0.4rem] px-0.5 rounded-[2px] mt-0.5 w-[90%] text-center uppercase font-black tracking-wider",
          level === "standard" ? "opacity-0 h-0" : "bg-black/20 text-current",
        )}
      >
        {level !== "standard" && level}
      </span>
    </div>
  );
}

export { PsuBadge };
