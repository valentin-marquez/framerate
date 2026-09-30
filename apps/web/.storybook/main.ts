import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../app/**/*.stories.tsx"],
  framework: {
    name: "@storybook/react-vite",
    // El vite.config del sitio trae los plugins de Cloudflare y React Router, que no corren fuera del sitio.
    options: { builder: { viteConfigPath: ".storybook/vite.config.ts" } },
  },
  staticDirs: ["../public"],
};

export default config;
