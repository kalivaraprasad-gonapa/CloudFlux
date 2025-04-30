// pages/api/upload-chunk.js
import {
  S3Client,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";

// Get environment variables
const cloudProvider = process.env.NEXT_PUBLIC_CLOUD_PROVIDER || "aws";
const bucketName =
  cloudProvider === "aws"
    ? process.env.NEXT_PUBLIC_AWS_S3_BUCKET
    : process.env.NEXT_PUBLIC_GCP_BUCKET_NAME;

// Initialize the storage client based on provider
const getStorageClient = () => {
  if (cloudProvider === "aws") {
    return new S3Client({
      region: process.env.NEXT_PUBLIC_AWS_REGION,
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
      },
    });
  } else if (cloudProvider === "gcp") {
    return new Storage({
      projectId: process.env.NEXT_PUBLIC_GCP_PROJECT_ID,
      credentials: {
        client_email: process.env.NEXT_PUBLIC_GCP_CLIENT_EMAIL,
        private_key: process.env.NEXT_PUBLIC_GCP_PRIVATE_KEY.replace(
          /\\n/g,
          "\n"
        ),
      },
    });
  } else {
    throw new Error(`Unsupported cloud provider: ${cloudProvider}`);
  }
};

// Configure Next.js API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // Limit each chunk to 10MB
    },
  },
};

// Store multipart upload IDs and GCP write streams
const multipartUploads = {};
const gcpWriteStreams = {};

// Store cancelled upload file IDs and their file keys
const cancelledUploads = new Set();
const fileKeyMap = new Map(); // Maps fileId to fileKey for cleanup purposes

// Helper function to delete a file from cloud storage
const deleteFileFromCloud = async (fileKey) => {
  try {
    if (cloudProvider === "aws") {
      const s3Client = getStorageClient();
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
        })
      );
      console.log(`Deleted file from AWS S3: ${fileKey}`);
    } else if (cloudProvider === "gcp") {
      const storage = getStorageClient();
      const bucket = storage.bucket(bucketName);
      await bucket.file(fileKey).delete();
      console.log(`Deleted file from GCP Storage: ${fileKey}`);
    }
    return true;
  } catch (error) {
    console.error(`Error deleting file ${fileKey} from cloud:`, error);
    return false;
  }
};

/**
 * Handles chunked file uploads to AWS S3 or Google Cloud Storage, supporting multipart upload initialization, chunk transfer, completion, status checks, and abort operations.
 *
 * Accepts POST requests with an `action` parameter to manage the upload lifecycle:
 * - `"initialize"`: Starts a new upload session and returns identifiers.
 * - `"status"`: Returns whether the upload has been cancelled.
 * - `"upload"`: Receives and stores a file chunk.
 * - `"complete"`: Finalizes the upload and returns the file URL.
 * - `"abort"`: Cancels the upload and attempts cleanup.
 *
 * @remark
 * Upload sessions and state are tracked in-memory and are not persistent across server restarts.
 *
 * @returns {void} Responds with JSON indicating success, error details, or upload status.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const {
      action,
      fileId,
      fileName,
      fileType,
      totalChunks,
      currentChunk,
      chunkData, // Base64 encoded chunk
      uploadId, // For AWS S3
      fileKey,
    } = req.body;

    // Check if this upload was previously cancelled
    if (action !== "abort" && cancelledUploads.has(fileId)) {
      return res.status(409).json({
        success: false,
        error: "Upload was cancelled",
        cancelled: true,
      });
    }

    // Initialize upload process
    if (action === "initialize") {
      // If this file was previously cancelled, remove it from cancelled list
      cancelledUploads.delete(fileId);

      const generatedFileKey = generateFileKey(fileName);

      // Store the file key mapping for potential cleanup later
      fileKeyMap.set(fileId, generatedFileKey);

      if (cloudProvider === "aws") {
        const s3Client = getStorageClient();
        const command = new CreateMultipartUploadCommand({
          Bucket: bucketName,
          Key: generatedFileKey,
          ContentType: fileType,
        });
        const response = await s3Client.send(command);
        multipartUploads[fileId] = {
          uploadId: response.UploadId,
          parts: [],
          fileKey: generatedFileKey,
        };
        return res.status(200).json({
          success: true,
          uploadId: response.UploadId,
          fileKey: generatedFileKey,
        });
      } else if (cloudProvider === "gcp") {
        const storage = getStorageClient();
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(generatedFileKey);
        const writeStream = file.createWriteStream({
          resumable: true,
          metadata: {
            contentType: fileType,
          },
        });
        // Store the write stream for this file ID
        gcpWriteStreams[fileId] = {
          writeStream,
          fileKey: generatedFileKey,
        };
        return res.status(200).json({
          success: true,
          fileKey: generatedFileKey,
        });
      }
    }
    // Check upload status
    else if (action === "status") {
      const isCancelled = cancelledUploads.has(fileId);
      return res.status(200).json({
        success: true,
        cancelled: isCancelled,
      });
    }
    // Upload a chunk
    else if (action === "upload") {
      const buffer = Buffer.from(chunkData, "base64");

      if (cloudProvider === "aws") {
        if (!multipartUploads[fileId]) {
          return res.status(400).json({
            success: false,
            error: "Upload session not found",
          });
        }

        const s3Client = getStorageClient();
        const partNumber = parseInt(currentChunk) + 1; // S3 parts start from 1
        const command = new UploadPartCommand({
          Bucket: bucketName,
          Key: fileKey,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: buffer,
        });
        const response = await s3Client.send(command);

        // Store the ETag for this part
        multipartUploads[fileId].parts.push({
          PartNumber: partNumber,
          ETag: response.ETag,
        });

        return res.status(200).json({
          success: true,
          partNumber,
          partsReceived: multipartUploads[fileId].parts.length,
        });
      } else if (cloudProvider === "gcp") {
        if (!gcpWriteStreams[fileId]) {
          return res.status(400).json({
            success: false,
            error: "Upload session not found",
          });
        }

        // Write the chunk to the GCP stream
        await new Promise((resolve, reject) => {
          gcpWriteStreams[fileId].writeStream.write(buffer, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });

        return res.status(200).json({
          success: true,
          chunkReceived: currentChunk,
        });
      }
    }
    // Complete upload
    else if (action === "complete") {
      if (cloudProvider === "aws") {
        if (!multipartUploads[fileId]) {
          return res.status(400).json({
            success: false,
            error: "Upload session not found",
          });
        }

        const s3Client = getStorageClient();
        const { parts, fileKey, uploadId } = multipartUploads[fileId];

        // Order parts by part number
        parts.sort((a, b) => a.PartNumber - b.PartNumber);

        const command = new CompleteMultipartUploadCommand({
          Bucket: bucketName,
          Key: fileKey,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        });

        await s3Client.send(command);

        // Clean up
        delete multipartUploads[fileId];
        fileKeyMap.delete(fileId); // No longer need this for cleanup

        const fileUrl = getFileUrl(fileKey);
        return res.status(200).json({
          success: true,
          key: fileKey,
          url: fileUrl,
        });
      } else if (cloudProvider === "gcp") {
        if (!gcpWriteStreams[fileId]) {
          return res.status(400).json({
            success: false,
            error: "Upload session not found",
          });
        }

        // End the write stream
        await new Promise((resolve, reject) => {
          gcpWriteStreams[fileId].writeStream.end((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        const fileKey = gcpWriteStreams[fileId].fileKey;
        const fileUrl = getFileUrl(fileKey);

        // Clean up
        delete gcpWriteStreams[fileId];
        fileKeyMap.delete(fileId); // No longer need this for cleanup

        return res.status(200).json({
          success: true,
          key: fileKey,
          url: fileUrl,
        });
      }
    }
    // Abort upload
    else if (action === "abort") {
      // Mark this upload as cancelled
      cancelledUploads.add(fileId);

      // Get the file key from the request or from our mapping
      const targetFileKey = fileKey || fileKeyMap.get(fileId);

      if (cloudProvider === "aws") {
        if (!multipartUploads[fileId] && !targetFileKey) {
          // Still return success if the upload wasn't found
          return res.status(200).json({
            success: true,
            message: "Upload marked as cancelled",
          });
        }

        const s3Client = getStorageClient();
        const uploadDetails = multipartUploads[fileId];
        const actualFileKey = uploadDetails
          ? uploadDetails.fileKey
          : targetFileKey;
        const actualUploadId = uploadDetails
          ? uploadDetails.uploadId
          : uploadId;

        if (actualUploadId) {
          try {
            // Abort the multipart upload
            const command = new AbortMultipartUploadCommand({
              Bucket: bucketName,
              Key: actualFileKey,
              UploadId: actualUploadId,
            });

            await s3Client.send(command);
          } catch (abortError) {
            console.error("Error aborting S3 multipart upload:", abortError);
          }
        }

        if (actualFileKey) {
          // Also attempt to delete any existing object with this key
          try {
            await deleteFileFromCloud(actualFileKey);
          } catch (deleteError) {
            console.error("Error deleting S3 file:", deleteError);
          }
        }

        // Clean up
        if (fileId in multipartUploads) {
          delete multipartUploads[fileId];
        }
        fileKeyMap.delete(fileId);

        return res.status(200).json({
          success: true,
          message: "Upload aborted and file cleanup attempted",
        });
      } else if (cloudProvider === "gcp") {
        if (!gcpWriteStreams[fileId] && !targetFileKey) {
          // Still return success if the upload wasn't found
          return res.status(200).json({
            success: true,
            message: "Upload marked as cancelled",
          });
        }

        if (fileId in gcpWriteStreams) {
          // Destroy the write stream
          gcpWriteStreams[fileId].writeStream.destroy();
        }

        const actualFileKey = gcpWriteStreams[fileId]
          ? gcpWriteStreams[fileId].fileKey
          : targetFileKey;

        if (actualFileKey) {
          // Delete the incomplete file
          try {
            await deleteFileFromCloud(actualFileKey);
          } catch (deleteError) {
            console.error("Error deleting GCP file:", deleteError);
          }
        }

        // Clean up
        if (fileId in gcpWriteStreams) {
          delete gcpWriteStreams[fileId];
        }
        fileKeyMap.delete(fileId);

        return res.status(200).json({
          success: true,
          message: "Upload aborted and file cleanup attempted",
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: "Invalid action",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * Generates a unique, date-based storage key for a file.
 *
 * The key includes a date-stamped folder, a random hex identifier, and a sanitized file name to prevent collisions and ensure safe storage paths.
 *
 * @param {string} fileName - The original name of the file to be stored.
 * @returns {string} A unique file key suitable for use in cloud storage.
 */
function generateFileKey(fileName) {
  // Create folder structure based on date
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  // Clean the file name
  const cleanName = fileName.replace(/[^\w\s.-]/g, "").replace(/\s+/g, "-");

  // Add unique ID to prevent overwriting
  const uniqueId = require("crypto").randomBytes(4).toString("hex");

  return `uploads/${year}-${month}-${day}/${uniqueId}-${cleanName}`;
}

/**
 * Returns the public URL for a file stored in the configured cloud provider's bucket.
 *
 * @param {string} fileKey - The unique key or path of the file in the bucket.
 * @returns {string|null} The public URL of the file, or {@code null} if the provider is unsupported.
 */
function getFileUrl(fileKey) {
  if (cloudProvider === "aws") {
    return `https://${bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${fileKey}`;
  } else if (cloudProvider === "gcp") {
    return `https://storage.googleapis.com/${bucketName}/${fileKey}`;
  }
  return null;
}
