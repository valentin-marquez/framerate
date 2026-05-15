import type { PerformanceEstimation } from "@framerate/db";

interface QuotePerformanceCardProps {
  performance: PerformanceEstimation;
}

const TIER_SUBTITLES: Record<string, string> = {
  "4K / Enthusiast": "4K Ultra · ray tracing · 60+ FPS",
  Elite: "1440p Ultra · ray tracing · 100+ FPS",
  "High / 1440p": "1440p alto · 60–100 FPS en AAA",
  "Mid / 1080p": "1080p alto · 60+ FPS en AAA",
  "Entry / Ofimática": "Productividad y eSports a 1080p",
};

export function QuotePerformanceCard({ performance }: QuotePerformanceCardProps) {
  const { cpuScore, gpuScore, totalScore, tier } = performance;
  const subtitle = TIER_SUBTITLES[tier] ?? "";

  return (
    <section
      aria-label="Estimación de rendimiento"
      className="rounded-2xl border border-border/40 bg-card p-6 md:p-7 animate-in fade-in slide-in-from-bottom-2"
    >
      {/* Caption */}
      <p className="text-[11px] uppercase tracking-[0.16em] font-medium text-muted-foreground mb-5">
        Rendimiento estimado
      </p>

      {/* Hero: tier + total side-by-side */}
      <div className="flex items-end justify-between gap-6 pb-6 border-b border-border/40">
        <div className="min-w-0">
          <h3 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground leading-none">{tier}</h3>
          {subtitle && <p className="text-sm text-muted-foreground mt-2.5 leading-snug">{subtitle}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl md:text-4xl font-medium tabular-nums tracking-tight text-foreground leading-none">
            {totalScore.toLocaleString("es-CL")}
          </p>
          <p className="text-xs text-muted-foreground mt-2.5">Score total</p>
        </div>
      </div>

      {/* Breakdown CPU + GPU */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        <ScoreCell label="CPU" value={cpuScore} weight={15} />
        <ScoreCell label="GPU" value={gpuScore} weight={85} />
      </div>
    </section>
  );
}

interface ScoreCellProps {
  label: string;
  value: number;
  weight: number;
}

function ScoreCell({ label, value, weight }: ScoreCellProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground/70 tabular-nums">{weight}%</span>
      </div>
      <p className="text-xl font-medium tabular-nums tracking-tight text-foreground leading-none">
        {Math.round(value).toLocaleString("es-CL")}
      </p>
    </div>
  );
}
