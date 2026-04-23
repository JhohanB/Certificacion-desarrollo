import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar librerías pesadas
          'pdf-libs': ['jspdf', 'jspdf-autotable', 'pdfjs-dist', 'html2canvas'],
          'excel-libs': ['xlsx'],
          'charts-libs': ['recharts'],
          'file-saver': ['file-saver'],
          // Separar Ant Design en chunks más pequeños
          'antd-core': ['antd'],
          'antd-icons': ['@ant-design/icons'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Aumentar límite de warning
  },
})
