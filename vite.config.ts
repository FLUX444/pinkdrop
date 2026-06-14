import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function seoHtmlPlugin(): Plugin {
  return {
    name: 'pinkdrop-seo-html',
    transformIndexHtml(html) {
      const env = loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', process.cwd(), '')
      const googleVerification = env.VITE_GOOGLE_SITE_VERIFICATION?.trim()
      const yandexVerification = env.VITE_YANDEX_VERIFICATION?.trim()

      let extra = '';
      if (googleVerification) {
        extra += `    <meta name="google-site-verification" content="${googleVerification}" />\n`;
      }
      if (yandexVerification) {
        extra += `    <meta name="yandex-verification" content="${yandexVerification}" />\n`;
      }
      if (!extra) return html;

      return html.replace('    <meta name="theme-color"', `${extra}    <meta name="theme-color"`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_URL || 'http://localhost:3001'

  return {
    plugins: [react(), seoHtmlPlugin()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          secure: false,
          changeOrigin: true,
          cookieDomainRewrite: '',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const host = req.headers.host;
              if (host) {
                proxyReq.setHeader('x-forwarded-host', host);
                proxyReq.setHeader('x-forwarded-proto', 'http');
              }
            });
          },
        },
        '/uploads': {
          target: apiTarget,
          secure: false,
          changeOrigin: true,
        },
        '/images': {
          target: apiTarget,
          secure: false,
          changeOrigin: true,
        },
        '/sitemap.xml': {
          target: apiTarget,
          secure: false,
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: false,
      cssMinify: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  }
})
