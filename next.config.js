/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    responseLimit: false,
    bodyParser: false,
  },
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  // Configure environment variables
  env: {
    // Cloud provider
    NEXT_PUBLIC_CLOUD_PROVIDER: process.env.NEXT_PUBLIC_CLOUD_PROVIDER || 'gcp',

    // AWS S3 variables
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    NEXT_PUBLIC_AWS_S3_BUCKET: process.env.NEXT_PUBLIC_AWS_S3_BUCKET,

    // Google Cloud Storage variables
    NEXT_PUBLIC_GCP_PROJECT_ID: process.env.NEXT_PUBLIC_GCP_PROJECT_ID,
    NEXT_PUBLIC_GCP_BUCKET_NAME: process.env.NEXT_PUBLIC_GCP_BUCKET_NAME,
  },
  // API configuration for larger payloads
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig;