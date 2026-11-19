import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl in "without i18n routing" mode: locale is resolved per-request
// from a cookie (src/i18n/request.ts), no [locale] segment in the URL.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default withNextIntl(nextConfig);
