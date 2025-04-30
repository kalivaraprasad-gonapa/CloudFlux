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
 * Handles POST requests for network speed testing by measuring the size of uploaded data and returning upload statistics.
 *
 * Accepts a payload via POST, validates its presence, introduces a brief artificial delay to simulate processing, and responds with the received size in bytes and megabytes along with a timestamp.
 *
 * @returns {void}
 *
 * @throws {Error} If an unexpected error occurs during request processing, responds with a 500 status and an error message.
 * @remark Responds with status 405 for non-POST methods and 400 if no content is provided.
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
