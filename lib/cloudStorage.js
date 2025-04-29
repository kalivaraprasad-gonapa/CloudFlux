// Cloud-agnostic storage utility supporting AWS S3 and Google Cloud Storage
import {
    S3Client,
    PutObjectCommand,
    HeadBucketCommand,
    ListObjectsV2Command,
    DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

// Determine which cloud provider to use
const cloudProvider = process.env.CLOUD_PROVIDER || 'aws';

// Initialize the appropriate storage client
const getStorageClient = () => {
    if (cloudProvider === 'aws') {
        return new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
    } else if (cloudProvider === 'gcp') {
        return new Storage({
            projectId: process.env.GCP_PROJECT_ID,
            credentials: {
                client_email: process.env.GCP_CLIENT_EMAIL,
                private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n')
            }
        });
    } else {
        throw new Error(`Unsupported cloud provider: ${cloudProvider}`);
    }
};

// Get bucket name based on provider
const getBucketName = () => {
    return cloudProvider === 'aws'
        ? process.env.AWS_S3_BUCKET
        : process.env.GCP_BUCKET_NAME;
};

// Check if bucket is accessible
export const checkBucketAccess = async () => {
    try {
        const bucketName = getBucketName();

        if (cloudProvider === 'aws') {
            const s3Client = getStorageClient();
            const command = new HeadBucketCommand({ Bucket: bucketName });
            await s3Client.send(command);
        } else if (cloudProvider === 'gcp') {
            const storage = getStorageClient();
            const [exists] = await storage.bucket(bucketName).exists();
            if (!exists) {
                throw new Error('GCP bucket does not exist');
            }
        }

        return true;
    } catch (error) {
        console.error(`Error accessing ${cloudProvider} bucket:`, error);
        return false;
    }
};

// Generate a unique key for the file
export const generateFileKey = (fileName) => {
    // Create folder structure based on date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // Clean the file name
    const cleanName = fileName.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '-');

    // Add unique ID to prevent overwriting
    const uniqueId = uuidv4().substring(0, 8);

    return `uploads/${year}/${month}/${day}/${uniqueId}-${cleanName}`;
};

// Get the URL of a file based on provider and bucket
export const getFileUrl = (fileKey) => {
    const bucketName = getBucketName();

    if (cloudProvider === 'aws') {
        return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    } else if (cloudProvider === 'gcp') {
        return `https://storage.googleapis.com/${bucketName}/${fileKey}`;
    }

    return null;
};

// Upload a file to cloud storage


export const uploadFile = async (file, fileName, fileType, onProgress = null) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    const bucketName = getBucketName();
    const fileKey = generateFileKey(fileName);
    let uploadId = null;

    try {
        if (cloudProvider === 'aws') {
            const s3Client = getStorageClient();

            const multipartInit = await s3Client.send(new CreateMultipartUploadCommand({
                Bucket: bucketName,
                Key: fileKey,
                ContentType: fileType
            }));

            uploadId = multipartInit.UploadId;

            const fileSize = file.size;
            const numParts = Math.ceil(fileSize / CHUNK_SIZE);
            const uploadPromises = [];
            const uploadedParts = new Array(numParts);

            const uploadPart = async (partNumber, start, end) => {
                const chunk = file.slice(start, end);
                const command = new UploadPartCommand({
                    Bucket: bucketName,
                    Key: fileKey,
                    PartNumber: partNumber,
                    UploadId: uploadId,
                    Body: chunk
                });
                const response = await s3Client.send(command);
                uploadedParts[partNumber - 1] = {
                    PartNumber: partNumber,
                    ETag: response.ETag
                };

                if (typeof onProgress === 'function') {
                    const completed = uploadedParts.filter(p => p).length;
                    const percentComplete = Math.round((completed / numParts) * 100);
                    onProgress(percentComplete);
                }
            };

            for (let i = 1; i <= numParts; i++) {
                const start = (i - 1) * CHUNK_SIZE;
                const end = Math.min(i * CHUNK_SIZE, fileSize);
                uploadPromises.push(uploadPart(i, start, end));
            }

            await Promise.all(uploadPromises);

            await s3Client.send(new CompleteMultipartUploadCommand({
                Bucket: bucketName,
                Key: fileKey,
                UploadId: uploadId,
                MultipartUpload: {
                    Parts: uploadedParts
                }
            }));

        } else if (cloudProvider === 'gcp') {
            const storage = getStorageClient();
            const bucket = storage.bucket(bucketName);
            const gcpFile = bucket.file(fileKey);
            const writeStream = gcpFile.createWriteStream({
                resumable: true,
                metadata: {
                    contentType: fileType
                }
            });

            let bytesUploaded = 0;

            for (let start = 0; start < file.size; start += CHUNK_SIZE) {
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                const buffer = Buffer.from(await chunk.arrayBuffer());

                await new Promise((resolve, reject) => {
                    writeStream.write(buffer, err => {
                        if (err) return reject(err);
                        bytesUploaded += buffer.length;

                        if (typeof onProgress === 'function') {
                            const percentComplete = Math.round((bytesUploaded / file.size) * 100);
                            onProgress(percentComplete);
                        }
                        resolve();
                    });
                });
            }

            await new Promise((resolve, reject) => {
                writeStream.end(err => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        const fileUrl = getFileUrl(fileKey);
        return {
            success: true,
            key: fileKey,
            url: fileUrl
        };

    } catch (error) {
        console.error(`Error uploading to ${cloudProvider}:`, error);

        if (cloudProvider === 'aws' && uploadId) {
            try {
                const s3Client = getStorageClient();
                await s3Client.send(new AbortMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: fileKey,
                    UploadId: uploadId
                }));
            } catch (abortError) {
                console.error('Error aborting multipart upload:', abortError);
            }
        }

        return {
            success: false,
            error: error.message
        };
    }
};


// Delete a file from cloud storage
export const deleteFile = async (fileKey) => {
    try {
        const bucketName = getBucketName();

        if (cloudProvider === 'aws') {
            // AWS S3 delete
            const s3Client = getStorageClient();
            const command = new DeleteObjectCommand({
                Bucket: bucketName,
                Key: fileKey
            });
            await s3Client.send(command);
        } else if (cloudProvider === 'gcp') {
            // Google Cloud Storage delete
            const storage = getStorageClient();
            const bucket = storage.bucket(bucketName);
            await bucket.file(fileKey).delete();
        }

        return {
            success: true
        };
    } catch (error) {
        console.error(`Error deleting from ${cloudProvider}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

// List recent files in the storage
export const listRecentFiles = async (maxItems = 20, prefix = 'uploads/') => {
    try {
        const bucketName = getBucketName();
        let files = [];

        if (cloudProvider === 'aws') {
            // AWS S3 list
            const s3Client = getStorageClient();
            const command = new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: prefix,
                MaxKeys: maxItems
            });

            const response = await s3Client.send(command);

            files = response.Contents.map(item => ({
                key: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
                url: getFileUrl(item.Key)
            }));
        } else if (cloudProvider === 'gcp') {
            // Google Cloud Storage list
            const storage = getStorageClient();
            const bucket = storage.bucket(bucketName);

            const [fileObjects] = await bucket.getFiles({
                prefix: prefix,
                maxResults: maxItems
            });

            files = fileObjects.map(file => ({
                key: file.name,
                size: parseInt(file.metadata.size, 10),
                lastModified: new Date(file.metadata.updated),
                url: getFileUrl(file.name)
            }));
        }

        return {
            success: true,
            files
        };
    } catch (error) {
        console.error(`Error listing ${cloudProvider} files:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

export default {
    getStorageClient,
    getBucketName,
    checkBucketAccess,
    generateFileKey,
    getFileUrl,
    uploadFile,
    deleteFile,
    listRecentFiles
};