import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { VitePWA } from "vite-plugin-pwa";

// SHA curto do commit no momento do build (cai para a env do Vercel se o git não estiver disponível)
function resolveBuildSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    const v = process.env.VERCEL_GIT_COMMIT_SHA;
    return v ? v.slice(0, 7) : "dev";
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_SHA__: JSON.stringify(resolveBuildSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico", "favicon-16.png", "favicon-32.png",
        "apple-touch-icon.png",
        "pwa-192.png", "pwa-512.png",
        "pwa-maskable-192.png", "pwa-maskable-512.png",
      ],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: "Encorpei Cardio — Acompanhamento cardiológico",
        short_name: "Encorpei Cardio",
        // A descrição anterior era literalmente a do Encorpei Mamãe ("pré-natal
        // acolhedor para gestantes e obstetras"). Ficava visível na loja/instalação
        // do PWA: o paciente cardíaco instalava um app que se anunciava como
        // pré-natal. Trocada pelo que o app de fato faz.
        description:
          "Acompanhamento cardiológico contínuo: pressão, batimentos, peso, sono, remédios e canal direto com seu cardiologista.",
        theme_color: "#F2F5F9",
        // background_color acompanha o background real do app (colors.ts).
        // Era #FAF7F5 — o sépia da marca de maternidade — e produzia um flash
        // bege na tela de splash antes do app pintar o azul-claro.
        background_color: "#F2F5F9",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        // Era "/minha-semana", nome da tela de semana gestacional. A rota ainda
        // existe só como redirect (appRoutes.tsx); apontar o start_url direto
        // para /hoje evita um salto de rota em toda abertura do PWA instalado.
        start_url: "/hoje",
        lang: "pt-BR",
        dir: "ltr",
        // "lifestyle" saiu: isso aqui é acompanhamento clínico prescrito por
        // médico, não app de bem-estar, e a categoria muda onde a loja indexa.
        categories: ["health", "medical"],
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        ],
        shortcuts: [
          { name: "Meus remédios", short_name: "Remédios", url: "/remedios", description: "Marcar as doses de hoje" },
          { name: "Registrar pressão", short_name: "Pressão", url: "/pressao", description: "Registrar uma medida de pressão" },
          { name: "Emergência", short_name: "Emergência", url: "/emergencia", description: "O que fazer se não estiver bem" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: mode === "production" ? "hidden" : true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["framer-motion", "sonner"],
          // recharts fora do vendor-ui: virou chunk separado (-384KB no bundle inicial)
          "vendor-charts": ["recharts"],
          // Manter em sincronia com as dependências @radix-ui de package.json.
          // Listar aqui um pacote que não é dependência quebra o build.
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-select",
            "@radix-ui/react-label",
            "@radix-ui/react-toast",
          ],
        },
      },
    },
  },
}));
