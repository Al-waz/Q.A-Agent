/** @type {import('next').NextConfig} */
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@qa/schemas"],
  async rewrites() {
    return [
      { source: "/api/chat", destination: `${apiBase}/chat` },
      { source: "/api/sessions", destination: `${apiBase}/sessions` },
      { source: "/api/sessions/:id", destination: `${apiBase}/sessions/:id` },
    ];
  },
};

export default nextConfig;
