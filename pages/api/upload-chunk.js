// pages/api/upload-chunk.js
import { S3Client, UploadPartCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';

// Get environment variables
const cloudProvider = process.env.NEXT_PUBLIC_CLOUD_PROVIDER || 'aws';
const bucketName = cloudProvider === 'aws'
    ? process.env.NEXT_PUBLIC_AWS_S3_BUCKET
    : process.env.NEXT_PUBLIC_GCP_BUCKET_NAME;

// Initialize the storage client based on provider
const getStorageClient = () => {
    if (cloudProvider === 'aws') {
        return new S3Client({
            region: process.env.NEXT_PUBLIC_AWS_REGION,
            credentials: {
                accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY
            }
        });
    } else if (cloudProvider === 'gcp') {
        return new Storage({
            projectId: process.env.NEXT_PUBLIC_GCP_PROJECT_ID,
            credentials: {
                client_email: process.env.NEXT_PUBLIC_GCP_CLIENT_EMAIL,
                private_key: process.env.NEXT_PUBLIC_GCP_PRIVATE_KEY.replace(/\\n/g, '\n')
            }
        });
    } else {
        throw new Error(`Unsupported cloud provider: ${cloudProvider}`);
    }
};

// Configure Next.js API route
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb', // Limit each chunk to 10MB
        },
    },
};

// Store multipart upload IDs and GCP write streams
const multipartUploads = {};
const gcpWriteStreams = {};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
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
            fileKey
        } = req.body;

        // Initialize upload process
        if (action === 'initialize') {
            const generatedFileKey = generateFileKey(fileName);

            if (cloudProvider === 'aws') {
                const s3Client = getStorageClient();
                const command = new CreateMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: generatedFileKey,
                    ContentType: fileType
                });

                const response = await s3Client.send(command);
                multipartUploads[fileId] = {
                    uploadId: response.UploadId,
                    parts: [],
                    fileKey: generatedFileKey
                };

                return res.status(200).json({
                    success: true,
                    uploadId: response.UploadId,
                    fileKey: generatedFileKey
                });
            } else if (cloudProvider === 'gcp') {
                const storage = getStorageClient();
                const bucket = storage.bucket(bucketName);
                const file = bucket.file(generatedFileKey);

                const writeStream = file.createWriteStream({
                    resumable: true,
                    metadata: {
                        contentType: fileType
                    }
                });

                // Store the write stream for this file ID
                gcpWriteStreams[fileId] = {
                    writeStream,
                    fileKey: generatedFileKey
                };

                return res.status(200).json({
                    success: true,
                    fileKey: generatedFileKey
                });
            }
        }

        // Upload a chunk
        else if (action === 'upload') {
            const buffer = Buffer.from(chunkData, 'base64');

            if (cloudProvider === 'aws') {
                if (!multipartUploads[fileId]) {
                    return res.status(400).json({
                        success: false,
                        error: 'Upload session not found'
                    });
                }

                const s3Client = getStorageClient();
                const partNumber = parseInt(currentChunk) + 1; // S3 parts start from 1

                const command = new UploadPartCommand({
                    Bucket: bucketName,
                    Key: fileKey,
                    PartNumber: partNumber,
                    UploadId: uploadId,
                    Body: buffer
                });

                const response = await s3Client.send(command);

                // Store the ETag for this part
                multipartUploads[fileId].parts.push({
                    PartNumber: partNumber,
                    ETag: response.ETag
                });

                return res.status(200).json({
                    success: true,
                    partNumber,
                    partsReceived: multipartUploads[fileId].parts.length
                });
            } else if (cloudProvider === 'gcp') {
                if (!gcpWriteStreams[fileId]) {
                    return res.status(400).json({
                        success: false,
                        error: 'Upload session not found'
                    });
                }

                // Write the chunk to the GCP stream
                await new Promise((resolve, reject) => {
                    gcpWriteStreams[fileId].writeStream.write(buffer, err => {
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
        else if (action === 'complete') {
            if (cloudProvider === 'aws') {
                if (!multipartUploads[fileId]) {
                    return res.status(400).json({
                        success: false,
                        error: 'Upload session not found'
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
                    MultipartUpload: { Parts: parts }
                });

                await s3Client.send(command);

                // Clean up
                delete multipartUploads[fileId];

                const fileUrl = getFileUrl(fileKey);

                return res.status(200).json({
                    success: true,
                    key: fileKey,
                    url: fileUrl
                });
            } else if (cloudProvider === 'gcp') {
                if (!gcpWriteStreams[fileId]) {
                    return res.status(400).json({
                        success: false,
                        error: 'Upload session not found'
                    });
                }

                // End the write stream
                await new Promise((resolve, reject) => {
                    gcpWriteStreams[fileId].writeStream.end(err => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                const fileKey = gcpWriteStreams[fileId].fileKey;
                const fileUrl = getFileUrl(fileKey);

                // Clean up
                delete gcpWriteStreams[fileId];

                return res.status(200).json({
                    success: true,
                    key: fileKey,
                    url: fileUrl
                });
            }
        }

        // Abort upload
        else if (action === 'abort') {
            if (cloudProvider === 'aws') {
                if (!multipartUploads[fileId]) {
                    return res.status(400).json({
                        success: false,
                        error: 'Upload session not found'
                    });
                }

                const s3Client = getStorageClient();
                const { fileKey, uploadId } = multipartUploads[fileId];

                const command = new AbortMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: fileKey,
                    UploadId: uploadId
                });

                await s3Client.send(command);

                // Clean up
                delete multipartUploads[fileId];

                return res.status(200).json({
                    success: true,
                    message: 'Upload aborted'
                });
            } else if (cloudProvider === 'gcp') {
                if (!gcpWriteStreams[fileId]) {
                    return res.status(400).json({
                        success: false,
                        error: 'Upload session not found'
                    });
                }

                // Destroy the write stream
                gcpWriteStreams[fileId].writeStream.destroy();

                // Delete the incomplete file
                const storage = getStorageClient();
                const bucket = storage.bucket(bucketName);
                const fileKey = gcpWriteStreams[fileId].fileKey;

                await bucket.file(fileKey).delete();

                // Clean up
                delete gcpWriteStreams[fileId];

                return res.status(200).json({
                    success: true,
                    message: 'Upload aborted'
                });
            }
        }

        return res.status(400).json({
            success: false,
            error: 'Invalid action'
        });

    } catch (error) {
        console.error('Upload error:', error);

        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}

// Generate a unique key for the file
function generateFileKey(fileName) {
    // Create folder structure based on date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // Clean the file name
    const cleanName = fileName.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '-');

    // Add unique ID to prevent overwriting
    const uniqueId = require('crypto').randomBytes(4).toString('hex');

    return `uploads/${year}/${month}/${day}/${uniqueId}-${cleanName}`;
}

// Get the URL of a file based on provider and bucket
function getFileUrl(fileKey) {
    if (cloudProvider === 'aws') {
        return `https://${bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${fileKey}`;
    } else if (cloudProvider === 'gcp') {
        return `https://storage.googleapis.com/${bucketName}/${fileKey}`;
    }
    return null;
}