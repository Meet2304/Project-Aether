/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Project Aether is a mobile-first PWA. We intentionally keep the PWA
  // surface minimal (no service worker) per the requirements, but expose
  // a few headers/settings that make the app behave well on mobile.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow camera access for the recording screen.
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self)",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
