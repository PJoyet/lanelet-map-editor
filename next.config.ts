import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
    output: "export",
    images: {
        unoptimized: true,
    },
    basePath: isGithubPages ? "/lanelet-map-editor" : "",
    assetPrefix: isGithubPages ? "/lanelet-map-editor/" : "",
};

export default nextConfig;