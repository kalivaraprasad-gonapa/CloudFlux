import { uploadFile } from "../../lib/cloudStorage";

// Configure Next.js API route to handle large files
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
    responseLimit: "50mb",
  },
};

/**
 * Handles large file uploads via POST requests, validating input and uploading files to cloud storage.
 *
 * Accepts a base64-encoded file in the request body, decodes it, and uploads it to a cloud storage provider. Responds with file metadata and storage details on success, or an error message on failure.
 *
 * @remark Only POST requests are supported; other methods receive a 405 response. The request body must include `fileName`, `fileType`, and `data` fields. Responds with HTTP 400 if required fields are missing, and HTTP 500 for upload or server errors.
 */
export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { fileName, fileType, fileSize, data, fileId } = req.body;

    if (!fileName || !fileType || !data) {
      return res.status(400).json({
        success: false,
        error: "Missing required file information",
      });
    }

    // Convert base64 back to buffer
    const fileBuffer = Buffer.from(data, "base64");

    // Track upload progress
    let uploadProgress = 0;
    const onProgress = (progressPercentage) => {
      uploadProgress = progressPercentage;
    };

    // Upload to cloud storage (AWS S3 or Google Cloud Storage)
    const result = await uploadFile(fileBuffer, fileName, fileType, onProgress);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || "Failed to upload file to cloud storage",
      });
    }

    // Return success with file info
    return res.status(200).json({
      success: true,
      fileName,
      fileType,
      fileSize,
      key: result.key,
      url: result.url,
      fileId,
    });
  } catch (error) {
    console.error("Upload error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
