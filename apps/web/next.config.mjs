/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@uscis-helper/db", "@uscis-helper/ai", "@uscis-helper/shared"],
};

export default nextConfig;
