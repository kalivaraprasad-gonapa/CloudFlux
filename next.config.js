/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    responseLimit: false,
    bodyParser: false,
  },
  reactStrictMode: true,
  swcMinify: true,
  // Configure environment variables
  env: {
    // Cloud provider
    CLOUD_PROVIDER: process.env.CLOUD_PROVIDER || 'aws',

    // AWS S3 variables
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,

    // Google Cloud Storage variables
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
    GCP_BUCKET_NAME: process.env.GCP_BUCKET_NAME,
  },
  // API configuration for larger payloads
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig;