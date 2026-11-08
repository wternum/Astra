import type { NextConfig } from "next";

// Serve the cloned ASTRA app (built with its own Vite config into public/astra/index.html) at "/".
const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/astra/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
