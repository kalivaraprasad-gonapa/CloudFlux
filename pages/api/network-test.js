// pages/api/network-test.js
// import { NextResponse } from "next/server";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // Allow uploads up to 10MB for testing
    },
  },
};

/**
 * API endpoint for network speed testing
 * Used to determine optimal upload settings based on network conditions
 *
 * This is a simple endpoint that:
 * 1. Accepts a test payload (file/blob of data)
 * 2. Times how long it takes to receive it
 * 3. Returns statistics about the upload
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get payload size from request
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);

    // Basic validation
    if (!contentLength) {
      return res.status(400).json({ error: "No content provided" });
    }

    // Add artificial delay to simulate server processing
    // This ensures we're measuring network speed, not just request overhead
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return statistics about the upload
    return res.status(200).json({
      success: true,
      received: contentLength,
      receivedMB: (contentLength / (1024 * 1024)).toFixed(2),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in network test:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
