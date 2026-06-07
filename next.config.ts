import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  // Prevent Next.js from picking up ~/package-lock.json as the monorepo root
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig;
