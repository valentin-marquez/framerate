import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // Todas las rutas en el manifiesto inicial: con "lazy" cada navegación a una ruta nueva espera antes un
  // `__manifest` (~125 ms) y sólo entonces pide el loader.
  routeDiscovery: { mode: "initial" },
  future: {
    v8_middleware: true,
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
