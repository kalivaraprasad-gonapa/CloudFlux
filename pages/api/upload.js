import { uploadFile } from '../../lib/cloudStorage';

// Configure Next.js API route to handle large files
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: '50mb',
  },
};

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    const { fileName, fileType, fileSize, data, fileId } = req.body;
    
    if (!fileName || !fileType || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required file information'
      });
    }
    
    // Convert base64 back to buffer
    const fileBuffer = Buffer.from(data, 'base64');
    
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
        error: result.error || 'Failed to upload file to cloud storage'
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
      fileId
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}