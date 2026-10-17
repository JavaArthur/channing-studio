import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import type { NextConfig } from "next";

function initCloudflareForDev() {
  const wranglerConfigPath = existsSync(resolve(process.cwd(), "wrangler.local.toml"))
    ? resolve(process.cwd(), "wrangler.local.toml")
    : resolve(process.cwd(), "wrangler.toml");

  void initOpenNextCloudflareForDev({ configPath: wranglerConfigPath });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  images: {
    unoptimized: true,
  },

  turbopack: {
    root: resolve(process.cwd()),
  },

  headers: async () => [
    ...['/admin/:path*', '/api/admin/:path*', '/editor', '/api/editor/:path*'].map(source => ({
      source, headers: [
        { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    })),
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],

  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    initCloudflareForDev();
  }

  return nextConfig;
}
