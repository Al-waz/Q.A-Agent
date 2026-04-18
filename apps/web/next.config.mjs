/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@qa/schemas"],
  async rewrites() {
    return [
      {
        source: "/api/chat",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/chat`,
      },
    ];
  },
};

export default nextConfig;
