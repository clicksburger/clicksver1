import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hay dos package-lock.json (legacy en la carpeta padre + este). Fijamos
  // la raíz de tracing a este proyecto para silenciar el warning.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  // Permitir el acceso desde la IP de la LAN en desarrollo.
  allowedDevOrigins: ["192.168.0.126"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
