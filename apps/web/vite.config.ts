import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { cn } from "cn/vite";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: {
        name: "ssr",
      },
    }),
    tailwindcss(),
    // `full`: tablas completas, no recortadas a las clases que encuentre (las clases armadas en runtime también se fusionan).
    cn({ full: true, css: false, config: "app/shared/lib/cn.config.ts", out: "app/shared/lib/cn-tables.ts" }),
    reactRouter(),
    tsconfigPaths(),
    devtoolsJson(),
  ],
  server: {
    open: true,
  },
  build: {
    minify: true,
  },
  optimizeDeps: {
    exclude: ["virtual:react-router/server-build"],
  },
});
