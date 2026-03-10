import type { NextConfig } from "next";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";

const appUrl = process.env.DATABRICKS_APP_URL;
const appPort = process.env.DATABRICKS_APP_PORT;

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  ...(appUrl && appPort
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${appUrl}:${appPort}/api/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default withFlowbiteReact(nextConfig);