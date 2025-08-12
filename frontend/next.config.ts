import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone", // Wymagane dla Docker production
   outputFileTracingIncludes: {
     "/": ["./public/**/*"],
   },
};

export default nextConfig;
