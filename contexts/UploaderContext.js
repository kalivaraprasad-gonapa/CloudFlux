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
  // Enhanced startUpload function with concurrency and error handling
  // This function handles the upload process, including chunked uploads and error handling
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

    // Function to update stats and history after each file completes
    const updateFileCompletion = async (file, fileKey, fileUrl) => {
      // Update local file status
      updateFileStatus(file.id, FILE_STATUS.COMPLETED, 100);

      // Update DB queue status
      await uploadQueueService.updateStatus(file.id, FILE_STATUS.COMPLETED);

      // Add to upload history immediately
      await uploadHistoryService.addToHistory({
        fileName: file.name,
        fileSize: file.size,
        status: FILE_STATUS.COMPLETED,
        fileKey: fileKey,
        url: fileUrl
      });

      // Update stats immediately
      statsManager.updateSuccessStats(1, file.size);

      // Fetch updated stats to update UI
      const updatedStats = statsManager.getStats();
      setStats(updatedStats);

      // Refresh upload history
      const history = await uploadHistoryService.getHistory(1, 20);
      setUploadHistory(history.items);
    };

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
              // Before processing each chunk, check if the upload has been cancelled
              // First check local state
              const currentFile = selectedFiles.find(f => f.id === file.id);
              if (currentFile?.status === FILE_STATUS.CANCELLED) {
                console.log(`Stopping upload of file ${file.name} because it was cancelled`);

                // Abort the multipart upload on the server
                try {
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
                } catch (abortError) {
                  console.error('Error notifying server about cancelled upload:', abortError);
                }

                return; // Exit the upload process for this file
              }

              // Additionally check with the server if this upload was cancelled from another session/tab
              try {
                const statusResponse = await fetch('/api/upload-chunk', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    action: 'status',
                    fileId: file.id
                  }),
                });

                if (statusResponse.ok) {
                  const statusResult = await statusResponse.json();
                  if (statusResult.cancelled) {
                    console.log(`Server reports upload of file ${file.name} was cancelled`);
                    // Update local state if not already cancelled
                    if (currentFile?.status !== FILE_STATUS.CANCELLED) {
                      updateFileStatus(file.id, FILE_STATUS.CANCELLED);
                    }
                    return; // Exit the upload process for this file
                  }
                }
              } catch (statusError) {
                console.warn('Error checking upload status:', statusError);
                // Continue with upload if we can't check status
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

              // Check the response to see if the server reports this upload as cancelled
              const chunkResult = await chunkResponse.json();
              if (chunkResult.cancelled) {
                console.log(`Server cancelled the upload during chunk processing`);
                if (currentFile?.status !== FILE_STATUS.CANCELLED) {
                  updateFileStatus(file.id, FILE_STATUS.CANCELLED);
                }
                return; // Exit the upload process for this file
              }

              // Update progress
              uploadedChunks++;
              currentProgress = Math.floor((uploadedChunks / totalChunks) * 100);
              updateFileStatus(file.id, FILE_STATUS.UPLOADING, currentProgress);
            }

            // One final check before completing
            const finalCheckFile = selectedFiles.find(f => f.id === file.id);
            if (finalCheckFile?.status === FILE_STATUS.CANCELLED) {
              console.log(`Upload was cancelled before completion`);
              return;
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

            // Update stats, DB, and history immediately for this completed file
            await updateFileCompletion(file, result.key, result.url);

          } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            updateFileStatus(file.id, FILE_STATUS.FAILED, 0, error.message);
            await uploadQueueService.updateStatus(file.id, FILE_STATUS.FAILED, file.retryCount + 1);
            statsManager.updateFailureStats(1);

            // Update stats in the UI for failures too
            const updatedStats = statsManager.getStats();
            setStats(updatedStats);
          }
        })
      );

      // Move to next batch
      currentBatch++;
      await uploadBatch();
    };

    // Start the first batch
    await uploadBatch();

    // Set uploading to false when all batches are done
    setIsUploading(false);

  }, [selectedFiles, isUploading, uploadConcurrency, updateFileStatus, setStats, setUploadHistory]);
  // Also update the cancelUpload method to abort multipart uploads
  const cancelUpload = useCallback(async (fileId) => {
    // First update the local state to reflect cancellation
    updateFileStatus(fileId, FILE_STATUS.CANCELLED);
    await uploadQueueService.updateStatus(fileId, FILE_STATUS.CANCELLED);

    try {
      // Actively notify the server to abort the upload
      await fetch('/api/upload-chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'abort',
          fileId: fileId
        }),
      });

      console.log(`Upload cancelled for file ID: ${fileId}`);
    } catch (error) {
      console.error('Error cancelling upload:', error);
      // Even if the server request fails, we still keep the local state as cancelled
    }
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
  // Enhanced cancelAllUploads function
  const cancelAllUploads = useCallback(async () => {
    setIsUploading(false);

    // Get all files that are currently uploading
    const uploadingFiles = selectedFiles.filter(file => file.status === FILE_STATUS.UPLOADING);

    if (uploadingFiles.length === 0) {
      return; // No files to cancel
    }

    // Update local status for each file
    for (const file of uploadingFiles) {
      updateFileStatus(file.id, FILE_STATUS.CANCELLED);
      await uploadQueueService.updateStatus(file.id, FILE_STATUS.CANCELLED);
    }

    // Notify server about all cancellations
    await Promise.allSettled(
      uploadingFiles.map(file =>
        fetch('/api/upload-chunk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'abort',
            fileId: file.id
          }),
        }).catch(error => console.error(`Error cancelling upload for ${file.name}:`, error))
      )
    );

    console.log(`Cancelled ${uploadingFiles.length} uploads`);
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