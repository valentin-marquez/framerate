// Lighthouse con throttling aplicado (no simulado) en tres teléfonos, mediana de RUNS corridas por ruta.
// Uso: bun scripts/perf-telefonos.ts [url ...]   (sin argumentos mide las rutas de navegación de producción)
// Lighthouse corre con node: bunx respeta su shebang.

const RUNS = 3;

// El ×CPU es relativo a la máquina que mide; están calibrados para un Ryzen 5 5600X (benchmarkIndex ~2800). En una
// máquina más lenta se bajan en proporción: el informe imprime el benchmarkIndex de cada corrida.
const PERFILES = {
  "gama baja, 4G lento": {
    cpu: 8,
    red: { requestLatencyMs: 562.5, downloadThroughputKbps: 1474.56, uploadThroughputKbps: 675 },
    pantalla: { width: 360, height: 800, deviceScaleFactor: 2 },
  },
  "gama media, 4G": {
    cpu: 4,
    red: { requestLatencyMs: 165, downloadThroughputKbps: 9000, uploadThroughputKbps: 1500 },
    pantalla: { width: 412, height: 915, deviceScaleFactor: 2.625 },
  },
  "gama alta, 4G": {
    cpu: 2,
    red: { requestLatencyMs: 165, downloadThroughputKbps: 9000, uploadThroughputKbps: 1500 },
    pantalla: { width: 393, height: 852, deviceScaleFactor: 3 },
  },
};

const RUTAS = [
  "https://framerate.cl/",
  "https://framerate.cl/categoria/tarjetas-de-video",
  "https://framerate.cl/producto/intel-core-i5-14600kf",
  "https://framerate.cl/buscar?q=rtx%205060",
];

type Perfil = (typeof PERFILES)[keyof typeof PERFILES];
type Medicion = { score: number; fcp: number; lcp: number; tbt: number; cls: number; si: number; bench: number };

async function lighthouse(url: string, p: Perfil): Promise<Medicion> {
  const proc = Bun.spawn(
    [
      "bunx",
      "lighthouse@13.5.0",
      url,
      "--quiet",
      "--output=json",
      "--only-categories=performance",
      "--form-factor=mobile",
      "--throttling-method=devtools",
      `--throttling.cpuSlowdownMultiplier=${p.cpu}`,
      ...Object.entries(p.red).map(([k, v]) => `--throttling.${k}=${v}`),
      ...Object.entries(p.pantalla).map(([k, v]) => `--screenEmulation.${k}=${v}`),
      "--screenEmulation.mobile",
      "--chrome-flags=--headless=new",
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const lhr = JSON.parse(await new Response(proc.stdout).text());
  const a = lhr.audits;
  return {
    score: Math.round(lhr.categories.performance.score * 100),
    fcp: a["first-contentful-paint"].numericValue,
    lcp: a["largest-contentful-paint"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    si: a["speed-index"].numericValue,
    bench: Math.round(lhr.environment.benchmarkIndex),
  };
}

const mediana = (xs: number[]) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

const filas = [];
for (const url of Bun.argv.length > 2 ? Bun.argv.slice(2) : RUTAS) {
  for (const [nombre, perfil] of Object.entries(PERFILES)) {
    const corridas: Medicion[] = [];
    for (let i = 0; i < RUNS; i++) corridas.push(await lighthouse(url, perfil));
    const m = (k: keyof Medicion) => mediana(corridas.map((c) => c[k]));
    const fila = {
      ruta: new URL(url).pathname + new URL(url).search,
      perfil: nombre,
      nota: m("score"),
      FCP: s(m("fcp")),
      LCP: s(m("lcp")),
      TBT: `${Math.round(m("tbt"))} ms`,
      CLS: m("cls").toFixed(3),
      SI: s(m("si")),
      bench: m("bench"),
    };
    console.error(fila);
    filas.push(fila);
  }
}
console.table(filas);
