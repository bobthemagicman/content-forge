import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: every route is an HTML shell and data loads on the client (research R1).
  output: "export",
  trailingSlash: true,
  images: {
    loader: "custom",
    loaderFile: "./src/lib/assets/image-loader.ts",
  },
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
