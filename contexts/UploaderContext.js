import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { uploadQueueService, uploadHistoryService, statsManager } from '../lib/db';

// Create context
const UploaderContext = createContext();

// Custom hook to use the uploader context
export const useUploader = () => useContext(UploaderContext);

// File status constants
export const FILE_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// Provider component
export const UploaderProvider = ({ children }) => {
  // States
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [stats, setStats] = useState({
    totalUploaded: 0,
    totalSize: 0,
    successCount: 0,
    failedCount: 0,
    lastUploadDate: null,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadConcurrency, setUploadConcurrency] = useState(3);
  const [cloudProvider, setCloudProvider] = useState('aws');

  // Load stats and cloud provider info from local storage on mount
  useEffect(() => {
    const loadStats = async () => {
      const savedStats = statsManager.getStats();
      setStats(savedStats);

      // Load recent upload history
      const history = await uploadHistoryService.getHistory(1, 20);
      setUploadHistory(history.items);

      // Load pending queue
      const queue = await uploadQueueService.getQueue();
      setUploadQueue(queue);

      // Get cloud provider from environment
      if (typeof window !== 'undefined') {
        // Client-side environment variables
        const provider = process.env.NEXT_PUBLIC_CLOUD_PROVIDER || 'aws';
        setCloudProvider(provider);
      }
    };

    loadStats();
  }, []);

  // Prepare files for upload (add to selection)
  const prepareFiles = useCallback((files) => {
    // Convert FileList to array
    const fileArray = Array.from(files);

    // Add unique ID to each file and prepare for tracking
    const preparedFiles = fileArray.map(file => {
      const fileId = uuidv4();

      // FIX: Create a proper file object with all the necessary properties
      // Instead of spreading the file (which doesn't work correctly with File objects),
      // we explicitly copy the properties we need
      return {
        id: fileId,
        name: file.name,         // Explicitly copy the name
        size: file.size,         // Explicitly copy the size
        type: file.type,         // Explicitly copy the type
        lastModified: file.lastModified,
        status: FILE_STATUS.PENDING,
        progress: 0,
        error: null,
        retryCount: 0,
        addedAt: new Date().toISOString(),
        // Store the original file for upload operations
        file: file  // Keep the original File object for uploading
      };
    });

    // Filter out duplicates based on name, size, and last modified date
    const newFiles = preparedFiles.filter(newFile => {
      return !selectedFiles.some(existingFile =>
        existingFile.name === newFile.name &&
        existingFile.size === newFile.size &&
        existingFile.lastModified === newFile.lastModified
      );
    });

    // Update selected files state
    setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);

    return newFiles;
  }, [selectedFiles]);

  // Remove file from selection
  const removeFile = useCallback((fileId) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
  }, []);

  // Clear all selected files
  const clearSelectedFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  // Update file status and progress
  const updateFileStatus = useCallback((fileId, status, progress = null, error = null) => {
    setSelectedFiles(prevFiles =>
      prevFiles.map(file => {
        if (file.id === fileId) {
          return {
            ...file,
            status,
            progress: progress !== null ? progress : file.progress,
            error: error !== null ? error : file.error,
            ...(status === FILE_STATUS.FAILED && { retryCount: file.retryCount + 1 }),
          };
        }
        return file;
      })
    );

    // Also update upload progress state for UI
    if (progress !== null) {
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: progress
      }));
    }
  }, []);

  // Start uploading files
  // const startUpload = useCallback(async () => {
  //   if (selectedFiles.length === 0 || isUploading) return;

  //   setIsUploading(true);

  //   // Filter out files that are already uploaded or being uploaded
  //   const filesToUpload = selectedFiles.filter(
  //     file => ![FILE_STATUS.COMPLETED, FILE_STATUS.UPLOADING].includes(file.status)
  //   );

  //   if (filesToUpload.length === 0) {
  //     setIsUploading(false);
  //     return;
  //   }

  //   // Add to upload queue in database for persistence
  //   await uploadQueueService.addToQueue(
  //     filesToUpload.map(({ name, size, type, id }) => ({
  //       fileName: name,
  //       fileSize: size,
  //       fileType: type,
  //       fileId: id
  //     }))
  //   );

  //   // Process files in batches based on concurrency
  //   let currentBatch = 0;
  //   const totalBatches = Math.ceil(filesToUpload.length / uploadConcurrency);

  //   const uploadBatch = async () => {
  //     const startIdx = currentBatch * uploadConcurrency;
  //     const endIdx = Math.min(startIdx + uploadConcurrency, filesToUpload.length);
  //     const currentFiles = filesToUpload.slice(startIdx, endIdx);

  //     if (currentFiles.length === 0) {
  //       // We're done with all batches
  //       setIsUploading(false);
  //       return;
  //     }

  //     // Process files in current batch in parallel
  //     await Promise.allSettled(
  //       currentFiles.map(async (file) => {
  //         try {
  //           // Update file status to uploading
  //           updateFileStatus(file.id, FILE_STATUS.UPLOADING, 0);
  //           await uploadQueueService.updateStatus(file.id, FILE_STATUS.UPLOADING);

  //           // Create file reader for this file
  //           const reader = new FileReader();

  //           // Get the actual File object - use the stored original
  //           const fileToUpload = file.file;

  //           // Make sure we have a valid File object
  //           if (!fileToUpload || !(fileToUpload instanceof File)) {
  //             throw new Error('Invalid file object');
  //           }

  //           // Convert file to array buffer
  //           const fileArrayBuffer = await new Promise((resolve, reject) => {
  //             reader.onload = () => resolve(reader.result);
  //             reader.onerror = () => reject(reader.error);
  //             reader.readAsArrayBuffer(fileToUpload);
  //           });

  //           // Convert array buffer to base64
  //           const base64Data = btoa(
  //             new Uint8Array(fileArrayBuffer)
  //               .reduce((data, byte) => data + String.fromCharCode(byte), '')
  //           );

  //           // Prepare upload data
  //           const uploadData = {
  //             fileName: file.name,
  //             fileType: file.type,
  //             fileSize: file.size,
  //             data: base64Data,
  //             fileId: file.id,
  //           };

  //           // Send to API endpoint
  //           const response = await fetch('/api/upload', {
  //             method: 'POST',
  //             headers: {
  //               'Content-Type': 'application/json',
  //             },
  //             body: JSON.stringify(uploadData),
  //           });

  //           // Setup upload progress tracking
  //           const progressInterval = setInterval(() => {
  //             const randomIncrement = Math.random() * 10;
  //             setUploadProgress(prev => {
  //               const currentProgress = prev[file.id] || 0;
  //               // Don't go over 90% until we confirm completion
  //               const newProgress = Math.min(90, currentProgress + randomIncrement);
  //               return { ...prev, [file.id]: newProgress };
  //             });
  //           }, 500);

  //           const result = await response.json();
  //           clearInterval(progressInterval);

  //           if (!response.ok) {
  //             throw new Error(result.error || 'Upload failed');
  //           }

  //           // Set progress to 100%
  //           updateFileStatus(file.id, FILE_STATUS.COMPLETED, 100);
  //           await uploadQueueService.updateStatus(file.id, FILE_STATUS.COMPLETED);

  //           // Add to upload history
  //           await uploadHistoryService.addToHistory({
  //             fileName: file.name,
  //             fileSize: file.size,
  //             status: FILE_STATUS.COMPLETED,
  //             fileKey: result.key,
  //             url: result.url
  //           });

  //           // Update stats
  //           statsManager.updateSuccessStats(1, file.size);

  //         } catch (error) {
  //           console.error(`Error uploading file ${file.name}:`, error);
  //           updateFileStatus(file.id, FILE_STATUS.FAILED, 0, error.message);
  //           await uploadQueueService.updateStatus(file.id, FILE_STATUS.FAILED, file.retryCount + 1);
  //           statsManager.updateFailureStats(1);
  //         }
  //       })
  //     );

  //     // Move to next batch
  //     currentBatch++;
  //     await uploadBatch();
  //   };

  //   // Start the first batch
  //   await uploadBatch();

  //   // Update stats from storage after upload completes
  //   const updatedStats = statsManager.getStats();
  //   setStats(updatedStats);

  //   // Refresh upload history
  //   const history = await uploadHistoryService.getHistory(1, 20);
  //   setUploadHistory(history.items);

  // }, [selectedFiles, isUploading, uploadConcurrency, updateFileStatus]);

  // Modified uploadFile method for UploaderProvider
  const startUpload = useCallback(async () => {
    if (selectedFiles.length === 0 || isUploading) return;

    setIsUploading(true);

    // Filter out files that are already uploaded or being uploaded
    const filesToUpload = selectedFiles.filter(
      file => ![FILE_STATUS.COMPLETED, FILE_STATUS.UPLOADING].includes(file.status)
    );

    if (filesToUpload.length === 0) {
      setIsUploading(false);
      return;
    }

    // Add to upload queue in database for persistence
    await uploadQueueService.addToQueue(
      filesToUpload.map(({ name, size, type, id }) => ({
        fileName: name,
        fileSize: size,
        fileType: type,
        fileId: id
      }))
    );

    // Process files in batches based on concurrency
    let currentBatch = 0;
    const totalBatches = Math.ceil(filesToUpload.length / uploadConcurrency);

    const uploadBatch = async () => {
      const startIdx = currentBatch * uploadConcurrency;
      const endIdx = Math.min(startIdx + uploadConcurrency, filesToUpload.length);
      const currentFiles = filesToUpload.slice(startIdx, endIdx);

      if (currentFiles.length === 0) {
        // We're done with all batches
        setIsUploading(false);
        return;
      }

      // Process files in current batch in parallel
      await Promise.allSettled(
        currentFiles.map(async (file) => {
          try {
            // Update file status to uploading
            updateFileStatus(file.id, FILE_STATUS.UPLOADING, 0);
            await uploadQueueService.updateStatus(file.id, FILE_STATUS.UPLOADING);

            // Get the actual File object
            const fileToUpload = file.file;

            // Make sure we have a valid File object
            if (!fileToUpload || !(fileToUpload instanceof File)) {
              throw new Error('Invalid file object');
            }

            // Initialize the chunked upload
            const initResponse = await fetch('/api/upload-chunk', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'initialize',
                fileId: file.id,
                fileName: file.name,
                fileType: file.type
              }),
            });

            if (!initResponse.ok) {
              throw new Error('Failed to initialize upload');
            }

            const initResult = await initResponse.json();

            if (!initResult.success) {
              throw new Error(initResult.error || 'Failed to initialize upload');
            }

            const { uploadId, fileKey } = initResult;

            // Define chunk size (5MB)
            const CHUNK_SIZE = 5 * 1024 * 1024;
            const totalChunks = Math.ceil(fileToUpload.size / CHUNK_SIZE);
            let uploadedChunks = 0;
            let currentProgress = 0;

            // Upload each chunk
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
              // Check if upload was cancelled
              const currentFile = selectedFiles.find(f => f.id === file.id);
              if (currentFile && currentFile.status === FILE_STATUS.CANCELLED) {
                // Abort the multipart upload
                await fetch('/api/upload-chunk', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    action: 'abort',
                    fileId: file.id,
                    uploadId,
                    fileKey
                  }),
                });
                return;
              }

              // Calculate chunk boundaries
              const start = chunkIndex * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, fileToUpload.size);
              const chunk = fileToUpload.slice(start, end);

              // Convert chunk to array buffer then to base64
              const fileArrayBuffer = await chunk.arrayBuffer();
              const base64Data = btoa(
                new Uint8Array(fileArrayBuffer)
                  .reduce((data, byte) => data + String.fromCharCode(byte), '')
              );

              // Upload this chunk
              const chunkResponse = await fetch('/api/upload-chunk', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'upload',
                  fileId: file.id,
                  fileKey,
                  uploadId,
                  currentChunk: chunkIndex,
                  totalChunks,
                  chunkData: base64Data
                }),
              });

              if (!chunkResponse.ok) {
                throw new Error(`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}`);
              }

              // Update progress
              uploadedChunks++;
              currentProgress = Math.floor((uploadedChunks / totalChunks) * 100);
              updateFileStatus(file.id, FILE_STATUS.UPLOADING, currentProgress);
            }

            // Complete the multipart upload
            const completeResponse = await fetch('/api/upload-chunk', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'complete',
                fileId: file.id,
                uploadId,
                fileKey
              }),
            });

            if (!completeResponse.ok) {
              throw new Error('Failed to complete upload');
            }

            const result = await completeResponse.json();

            if (!result.success) {
              throw new Error(result.error || 'Failed to complete upload');
            }

            // Set progress to 100%
            updateFileStatus(file.id, FILE_STATUS.COMPLETED, 100);
            await uploadQueueService.updateStatus(file.id, FILE_STATUS.COMPLETED);

            // Add to upload history
            await uploadHistoryService.addToHistory({
              fileName: file.name,
              fileSize: file.size,
              status: FILE_STATUS.COMPLETED,
              fileKey: result.key,
              url: result.url
            });

            // Update stats
            statsManager.updateSuccessStats(1, file.size);

          } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            updateFileStatus(file.id, FILE_STATUS.FAILED, 0, error.message);
            await uploadQueueService.updateStatus(file.id, FILE_STATUS.FAILED, file.retryCount + 1);
            statsManager.updateFailureStats(1);
          }
        })
      );

      // Move to next batch
      currentBatch++;
      await uploadBatch();
    };

    // Start the first batch
    await uploadBatch();

    // Update stats from storage after upload completes
    const updatedStats = statsManager.getStats();
    setStats(updatedStats);

    // Refresh upload history
    const history = await uploadHistoryService.getHistory(1, 20);
    setUploadHistory(history.items);

  }, [selectedFiles, isUploading, uploadConcurrency, updateFileStatus]);

  // Also update the cancelUpload method to abort multipart uploads
  const cancelUpload = useCallback(async (fileId) => {
    updateFileStatus(fileId, FILE_STATUS.CANCELLED);
    await uploadQueueService.updateStatus(fileId, FILE_STATUS.CANCELLED);

    // We don't need to explicitly abort the upload here
    // The upload process checks for cancelled status between chunks

  }, [updateFileStatus]);

  // Retry failed uploads
  const retryFailedUploads = useCallback(() => {
    // Find all failed files
    const failedFiles = selectedFiles.filter(file => file.status === FILE_STATUS.FAILED);

    if (failedFiles.length === 0) return;

    // Reset their status to pending
    failedFiles.forEach(file => {
      updateFileStatus(file.id, FILE_STATUS.PENDING, 0);
    });

    // Start upload again
    startUpload();
  }, [selectedFiles, updateFileStatus, startUpload]);



  // Cancel all uploads
  const cancelAllUploads = useCallback(() => {
    setIsUploading(false);

    // Update status for each file that's currently uploading
    selectedFiles.forEach(file => {
      if (file.status === FILE_STATUS.UPLOADING) {
        updateFileStatus(file.id, FILE_STATUS.CANCELLED);
        uploadQueueService.updateStatus(file.id, FILE_STATUS.CANCELLED);
      }
    });
  }, [selectedFiles, updateFileStatus]);

  // Process a folder
  const processFolder = useCallback(async (folderHandle) => {
    try {
      const files = [];

      // Recursive function to process directories
      async function processDirectoryEntry(dirHandle, path = '') {
        for await (const entry of dirHandle.values()) {
          const entryPath = path ? `${path}/${entry.name}` : entry.name;

          if (entry.kind === 'file') {
            const file = await entry.getFile();
            // Create a new file with path information
            const fileWithPath = new File([file], entryPath, {
              type: file.type,
              lastModified: file.lastModified,
            });
            files.push(fileWithPath);
          } else if (entry.kind === 'directory') {
            // Recursively process subdirectories
            await processDirectoryEntry(entry, entryPath);
          }
        }
      }

      await processDirectoryEntry(folderHandle);

      if (files.length > 0) {
        prepareFiles(files);
      }

      return files.length;
    } catch (error) {
      console.error('Error processing folder:', error);
      return 0;
    }
  }, [prepareFiles]);

  // Value to be provided by the context
  const value = {
    selectedFiles,
    uploadQueue,
    uploadHistory,
    stats,
    isUploading,
    uploadProgress,
    uploadConcurrency,
    cloudProvider,
    setUploadConcurrency,
    prepareFiles,
    removeFile,
    clearSelectedFiles,
    startUpload,
    cancelUpload,
    cancelAllUploads,
    retryFailedUploads,
    updateFileStatus,
    processFolder,
  };

  return (
    <UploaderContext.Provider value={value}>
      {children}
    </UploaderContext.Provider>
  );
};

export default UploaderContext;