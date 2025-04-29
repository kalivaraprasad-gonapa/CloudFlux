// This file will only be used server-side in API routes
import { 
    S3Client, 
    PutObjectCommand,
    HeadBucketCommand,
    ListObjectsV2Command,
    DeleteObjectCommand
  } from '@aws-sdk/client-s3';
  import { Upload } from '@aws-sdk/lib-storage';
  import { v4 as uuidv4 } from 'uuid';
  
  // Initialize S3 client (only for server-side use)
  export const getS3Client = () => {
    return new S3Client({
      region: process.env.NEXT_PUBLIC_AWS_REGION,
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY
      }
    });
  };
  
  // Check if S3 bucket is accessible
  export const checkBucketAccess = async () => {
    try {
      const s3Client = getS3Client();
      const command = new HeadBucketCommand({ Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET });
      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error accessing S3 bucket:', error);
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
  
  // Upload a single file to S3
  export const uploadFileToS3 = async (fileBuffer, fileName, fileType, onProgress) => {
    try {
      const s3Client = getS3Client();
      const fileKey = generateFileKey(fileName);
      
      // Use the multipart upload utility for better handling of large files
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET,
          Key: fileKey,
          Body: fileBuffer,
          ContentType: fileType
        }
      });
      
      // Set up progress tracking if callback provided
      if (typeof onProgress === 'function') {
        upload.on('httpUploadProgress', (progress) => {
          const percentComplete = Math.round((progress.loaded / progress.total) * 100);
          onProgress(percentComplete);
        });
      }
      
      // Execute the upload
      await upload.done();
      
      // Generate the URL for the uploaded file
      const fileUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${fileKey}`;
      
      return {
        success: true,
        key: fileKey,
        url: fileUrl
      };
    } catch (error) {
      console.error('Error uploading to S3:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };
  
  // Upload a single file using regular PutObjectCommand (for smaller files)
  export const uploadSmallFile = async (fileBuffer, fileName, fileType) => {
    try {
      const s3Client = getS3Client();
      const fileKey = generateFileKey(fileName);
      
      const command = new PutObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: fileType
      });
      
      await s3Client.send(command);
      
      // Generate the URL for the uploaded file
      const fileUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${fileKey}`;
      
      return {
        success: true,
        key: fileKey,
        url: fileUrl
      };
    } catch (error) {
      console.error('Error uploading to S3:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };
  
  // Delete a file from S3
  export const deleteFileFromS3 = async (fileKey) => {
    try {
      const s3Client = getS3Client();
      
      const command = new DeleteObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET,
        Key: fileKey
      });
      
      await s3Client.send(command);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Error deleting from S3:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };
  
  // List recent files in the bucket
  export const listRecentFiles = async (maxItems = 20, prefix = 'uploads/') => {
    try {
      const s3Client = getS3Client();
      
      const command = new ListObjectsV2Command({
        Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET,
        Prefix: prefix,
        MaxKeys: maxItems
      });
      
      const response = await s3Client.send(command);
      
      const files = response.Contents.map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        url: `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${item.Key}`
      }));
      
      return {
        success: true,
        files
      };
    } catch (error) {
      console.error('Error listing S3 files:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };
  
  export default {
    getS3Client,
    checkBucketAccess,
    generateFileKey,
    uploadFileToS3,
    uploadSmallFile,
    deleteFileFromS3,
    listRecentFiles
  };