import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone", // Wymagane dla Docker production
   outputFileTracingIncludes: {
     "/": ["./public/**/*"],
   },

  compiler: {
    emotion: true,
  },
};

export default nextConfig;
