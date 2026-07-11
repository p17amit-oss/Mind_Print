/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pages Router (NOT App Router) — see BUILD PROMPT Section 1.
  // App Router is intentionally not enabled.
  eslint: {
    // CI runs lint + compliance grep separately; keep builds unblocked by style.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
