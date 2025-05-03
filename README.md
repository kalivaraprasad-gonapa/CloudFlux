# CloudFlux - Multi-Cloud File Uploader

![CloudFlux Logo](https://via.placeholder.com/150x150?text=CloudFlux)

CloudFlux is a powerful, cloud-agnostic file uploader built with Next.js that supports both AWS S3 and Google Cloud Storage. It features chunked file uploads to handle files of virtually any size, a modern React UI with real-time progress tracking, and a persistent queue system for reliability.


## ✨ Features

- **Cloud Agnostic** - Seamlessly switch between AWS S3 and Google Cloud Storage
- **Chunked Uploads** - Handle files of any size without memory issues (tested with 800MB+ files)
- **Resumable Uploads** - Pick up where you left off after interruptions
- **Concurrent Uploads** - Upload multiple files simultaneously with configurable concurrency
- **Folder Upload** - Preserve folder structure when uploading directories
- **Upload Queue** - Persistent queue for reliability across page refreshes
- **Real-time Progress** - Accurate progress tracking for each file
- **Upload History** - View and manage your upload history
- **Responsive UI** - Modern, mobile-friendly interface
- **Customizable** - Easily extend with your own storage providers

## 🚀 Demo

[See CloudFlux in action](#) *(Coming Soon)*

## 📋 Prerequisites

- Node.js 18.x or higher
- npm or yarn
- AWS S3 bucket or Google Cloud Storage bucket
- Appropriate IAM/permissions configured

## 🔧 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kalivaraprasad-gonapa/CloudFlux
   cd cloudflux
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables by creating a `.env.local` file:
   ```
   # Common
   NEXT_PUBLIC_CLOUD_PROVIDER=aws  # or 'gcp'
   
   # AWS Configuration
   NEXT_PUBLIC_AWS_ACCESS_KEY_ID=your_access_key_id
   NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=your_secret_access_key
   NEXT_PUBLIC_AWS_REGION=your_region
   NEXT_PUBLIC_AWS_S3_BUCKET=your_bucket_name
   
   # Google Cloud Configuration
   NEXT_PUBLIC_GCP_PROJECT_ID=your_project_id
   NEXT_PUBLIC_GCP_CLIENT_EMAIL=your_client_email
   NEXT_PUBLIC_GCP_PRIVATE_KEY=your_private_key
   NEXT_PUBLIC_GCP_BUCKET_NAME=your_bucket_name
   ```

4. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## 📂 Project Structure

```
cloudflux/
├── components/             # React components
│   ├── FileList.jsx        # File list display
│   ├── FileUploader.jsx    # Main uploader component
│   ├── ProgressBar.jsx     # Upload progress visualization
│   └── UploadHistory.jsx   # History of uploads
├── context/                # React context providers
│   └── UploaderProvider.jsx # Uploader state management
├── lib/                    # Utility functions
│   ├── cloudStorage.js     # Cloud provider abstraction
│   └── db.js               # IndexedDB storage for queue/history
├── pages/                  # Next.js pages
│   ├── api/                # API routes
│   │   ├── upload.js       # Legacy single-request upload
│   │   └── upload-chunk.js # Chunked upload implementation
│   └── index.js            # Main page
├── public/                 # Static assets
├── styles/                 # CSS styles
└── next.config.js          # Next.js configuration
```

## 💻 Usage

### Basic Usage

1. Drag and drop files or use the file picker
2. Click "Upload" to start the upload process
3. Monitor progress in real-time
4. View uploaded files in the history tab

### Advanced Usage

#### Configuring Upload Concurrency

```javascript
// In your component
import { useUploader } from '../context/UploaderProvider';

function YourComponent() {
  const { setUploadConcurrency } = useUploader();
  
  return (
    <div>
      <select onChange={(e) => setUploadConcurrency(Number(e.target.value))}>
        <option value="1">Low (1 file at a time)</option>
        <option value="3">Medium (3 files at a time)</option>
        <option value="5">High (5 files at a time)</option>
      </select>
    </div>
  );
}
```

#### Implementing Folder Upload

```javascript
// In your component
import { useUploader } from '../context/UploaderProvider';

function FolderUploader() {
  const { processFolder } = useUploader();
  
  const handleFolderSelect = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const filesCount = await processFolder(dirHandle);
      console.log(`Added ${filesCount} files from folder`);
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };
  
  return (
    <button onClick={handleFolderSelect}>
      Upload Folder
    </button>
  );
}
```

## 🔄 API

### Uploader Context

The `UploaderProvider` provides the following context values:

| Property | Type | Description |
|----------|------|-------------|
| `selectedFiles` | Array | Files selected for upload |
| `uploadQueue` | Array | Currently queued files |
| `uploadHistory` | Array | History of uploads |
| `stats` | Object | Upload statistics |
| `isUploading` | Boolean | Whether uploads are in progress |
| `uploadProgress` | Object | Progress for each file |
| `uploadConcurrency` | Number | How many files to upload at once |
| `cloudProvider` | String | Current cloud provider ('aws' or 'gcp') |
| `prepareFiles` | Function | Add files to the upload queue |
| `removeFile` | Function | Remove file from queue |
| `clearSelectedFiles` | Function | Clear all selected files |
| `startUpload` | Function | Start the upload process |
| `cancelUpload` | Function | Cancel a specific upload |
| `cancelAllUploads` | Function | Cancel all active uploads |
| `retryFailedUploads` | Function | Retry any failed uploads |
| `processFolder` | Function | Process a folder for upload |

### Cloud Storage API

The `cloudStorage.js` utility provides these functions:

| Function | Parameters | Description |
|----------|------------|-------------|
| `checkBucketAccess` | None | Verify bucket is accessible |
| `generateFileKey` | `fileName` | Generate a unique key for a file |
| `getFileUrl` | `fileKey` | Get the URL of an uploaded file |
| `uploadFile` | `file, fileName, fileType, onProgress` | Upload a file (legacy) |
| `deleteFile` | `fileKey` | Delete a file from storage |
| `listRecentFiles` | `maxItems, prefix` | List recent uploads |

## 🛠️ How It Works

### Chunked Upload Process

1. **Initialization**: 
   - Create a multipart upload on AWS or a resumable upload on GCP
   - Get an upload ID or write stream
   
2. **Chunking**:
   - Split file into 5MB chunks
   - Upload each chunk separately with progress tracking
   
3. **Completion**:
   - Finalize the multipart upload

### Database Structure

CloudFlux uses IndexedDB for local storage:

- **Upload Queue**: Persists across page refreshes
- **Upload History**: Tracks all completed uploads
- **Stats**: Maintains usage statistics

## 📱 Mobile Support

CloudFlux is responsive and works on mobile devices. Touch interactions are supported for:

- File selection
- Progress monitoring
- Upload management

## 🔒 Security Considerations

- Client-side credentials are never exposed
- All API calls are made server-side
- Files are processed in chunks to prevent memory exploits
- Content type validation is performed
- Unique file keys prevent overwrites


## 🔍 Troubleshooting

### Common Issues

1. **"Out of memory" errors**
   - Make sure you're using the chunked upload API
   - Check the chunk size (default 5MB)
   
2. **Upload seems stuck**
   - Check network connectivity
   - Verify cloud provider credentials
   - Inspect browser console for errors

3. **Slow uploads**
   - Try reducing the `uploadConcurrency` value
   - Check your network bandwidth
   - Consider optimizing file size before upload

