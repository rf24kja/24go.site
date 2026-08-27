/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    API_URL: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  },
  // Vercel: no standalone needed, it handles it
  // Docker: standalone works fine
  images: {
    unoptimized: true,
  },
}
module.exports = nextConfig
