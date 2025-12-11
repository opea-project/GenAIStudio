import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dotenv from 'dotenv'

export default defineConfig(async ({ mode }) => {
    let proxy = undefined
    if (mode === 'development') {
        const serverEnv = dotenv.config({ processEnv: {}, path: '../server/.env' }).parsed
        const serverHost = serverEnv?.['HOST'] ?? 'localhost'
        const serverPort = parseInt(serverEnv?.['PORT'] ?? '3000')
        proxy = {
            '/api': {
                target: `http://${serverHost}:${serverPort}`,
                changeOrigin: true,
                secure: false
            },
            '/socket.io': {
                target: `http://${serverHost}:${serverPort}`,
                changeOrigin: true,
                ws: true,
                secure: false
            }
        }
    }
    dotenv.config()
    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src')
            }
        },
        root: resolve(__dirname),
        build: {
            outDir: './build'
        },
        server: {
            open: true,
            // proxy,
            port: process.env.VITE_PORT ?? 8088,
            host: process.env.VITE_HOST ?? '0.0.0.0'
            ,
            proxy: {
                '/api': {
                    target: 'http://localhost:3000',
                    changeOrigin: true
                },
                '/socket.io': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    ws: true
                },
                // 👉 把所有 /auth/** 请求都转给 Keycloak
                '/auth': {
                    target: 'http://localhost:8080',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/auth/, '/auth'),
                }
            }
        }
    }
})
