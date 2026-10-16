// El preset "mobile" de Unlighthouse no frena la CPU (cpuSlowdownMultiplier: 1) y da notas de teléfono con CPU de
// escritorio. Esto devuelve el móvil estándar de Lighthouse: 4G lento y CPU ×4. Para comparar teléfonos concretos:
// scripts/perf-telefonos.ts.
export default {
  lighthouseOptions: {
    throttlingMethod: "simulate",
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.56,
      uploadThroughputKbps: 675,
      cpuSlowdownMultiplier: 4,
    },
  },
};
