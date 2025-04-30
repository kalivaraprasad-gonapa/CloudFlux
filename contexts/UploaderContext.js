// contexts/UploaderContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { v4 as uuidv4 } from "uuid";
import {
  uploadQueueService,
  uploadHistoryService,
  statsManager,
} from "../lib/db";

// Create context
const UploaderContext = createContext();

// Custom hook to use the uploader context
export const useUploader = () => useContext(UploaderContext);

// File status constants
export const FILE_STATUS = {
  PENDING: "pending",
  UPLOADING: "uploading",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

// Provider component
export const UploaderProvider = ({ children }) => {
  // File and upload states
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

  // Performance configuration states
  const [uploadConcurrency, setUploadConcurrency] = useState(3);
  const [maxParallelChunks, setMaxParallelChunks] = useState(3);
  const [chunkSize, setChunkSize] = useState(5 * 1024 * 1024); // Default 5MB
  const [cloudProvider, setCloudProvider] = useState("aws");
  const [networkPreset, setNetworkPreset] = useState("auto"); // Default to auto mode
  const [networkStats, setNetworkStats] = useState({
    lastTested: null,
    uploadSpeedMbps: 0,
    downlink: 0,
    rtt: 0,
    effectiveType: "unknown",
    networkType: "unknown",
    detectedPreset: "medium",
  });

  // Load settings from local storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Load stats
      const savedStats = statsManager.getStats();
      setStats(savedStats);

      // Load recent upload history
      const history = await uploadHistoryService.getHistory(1, 20);
      setUploadHistory(history.items);

      // Load pending queue
      const queue = await uploadQueueService.getQueue();
      setUploadQueue(queue);

      if (typeof window !== "undefined") {
        // Get cloud provider from environment
        const provider = process.env.NEXT_PUBLIC_CLOUD_PROVIDER || "aws";
        setCloudProvider(provider);

        // Load upload performance settings from localStorage
        const savedChunks = localStorage.getItem("maxParallelChunks");
        const savedChunkSize = localStorage.getItem("chunkSize");
        const savedConcurrency = localStorage.getItem("uploadConcurrency");
        const savedNetworkPreset = localStorage.getItem("networkPreset");

        if (savedChunks) setMaxParallelChunks(parseInt(savedChunks, 10));
        if (savedChunkSize)
          setChunkSize(parseInt(savedChunkSize, 10) * 1024 * 1024);
        if (savedConcurrency)
          setUploadConcurrency(parseInt(savedConcurrency, 10));
        if (savedNetworkPreset) setNetworkPreset(savedNetworkPreset);

        // Also load network stats if they exist
        const savedNetworkStats = localStorage.getItem("networkStats");
        if (savedNetworkStats) {
          try {
            const parsedStats = JSON.parse(savedNetworkStats);
            // Convert date string back to Date object
            if (parsedStats.lastTested) {
              parsedStats.lastTested = new Date(parsedStats.lastTested);
            }
            setNetworkStats(parsedStats);
          } catch (e) {
            console.error("Error parsing saved network stats", e);
          }
        }

        // If in auto mode or no recent test, schedule a network test
        if (savedNetworkPreset === "auto" || !savedNetworkStats) {
          // Schedule network test after a short delay to not block initial load
          setTimeout(() => {
            testNetworkSpeed();
          }, 2000);
        }
      }
    };

    loadSettings();
  }, []);

  // Function to test network speed and determine optimal settings
  const testNetworkSpeed = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      // Get basic connection info from Navigator.connection if available
      let connectionInfo = {
        downlink: 0,
        rtt: 0,
        effectiveType: "unknown",
        networkType: "unknown",
      };

      if (navigator.connection) {
        connectionInfo = {
          downlink: navigator.connection.downlink || 0, // Mbps
          rtt: navigator.connection.rtt || 0, // Round-trip time in ms
          effectiveType: navigator.connection.effectiveType || "unknown", // 4g, 3g, 2g, slow-2g
          networkType: navigator.connection.type || "unknown", // wifi, cellular, etc.
        };
      }

      // Test actual upload speed with a test payload
      const testSizeKB = 200; // 200KB test file
      const iterations = 3; // Test multiple times for better accuracy

      let totalUploadTime = 0;

      for (let i = 0; i < iterations; i++) {
        // Create a test payload of specified size
        const payload = new Blob([new ArrayBuffer(testSizeKB * 1024)]);

        // Measure time to upload
        const startTime = performance.now();

        // Perform a test upload (to a no-op endpoint that just returns success)
        const response = await fetch("/api/network-test", {
          method: "POST",
          body: payload,
        });

        if (!response.ok) {
          throw new Error("Network test failed");
        }

        const endTime = performance.now();
        totalUploadTime += endTime - startTime;
      }

      // Calculate average upload speed in Mbps
      const avgUploadTime = totalUploadTime / iterations; // ms
      // (KB → bytes → bits → Mbit)  :  KB * 1024 * 8 / 1_048_576  ≡  KB * 8 / 1024
      const uploadSpeedMbps =
        (testSizeKB * 8) / 1024 / (avgUploadTime / 1000); // Mbps

      // Log test results
      console.log("Network test results:", {
        uploadSpeedMbps,
        avgUploadTime,
        connectionInfo,
      });

      // Determine optimal preset based on test results
      let detectedPreset = "medium"; // Default

      if (uploadSpeedMbps > 50 && connectionInfo.rtt < 50) {
        detectedPreset = "ultrafast"; // Very fast connection
      } else if (uploadSpeedMbps > 20 && connectionInfo.rtt < 100) {
        detectedPreset = "fast"; // Fast connection
      } else if (uploadSpeedMbps > 5 && connectionInfo.rtt < 200) {
        detectedPreset = "medium"; // Medium connection
      } else {
        detectedPreset = "slow"; // Slow connection
      }

      // Update network stats
      const newNetworkStats = {
        ...connectionInfo,
        uploadSpeedMbps: uploadSpeedMbps.toFixed(2),
        lastTested: new Date(),
        detectedPreset,
      };

      // Save to state and localStorage
      setNetworkStats(newNetworkStats);
      localStorage.setItem("networkStats", JSON.stringify(newNetworkStats));

      // If in auto mode, apply the detected preset
      if (networkPreset === "auto") {
        applyNetworkPreset(detectedPreset, true);
      }

      return detectedPreset;
    } catch (error) {
      console.error("Error testing network speed:", error);
      return "medium"; // Fallback to medium on errors
    }
  }, [networkPreset]);

  // Apply network speed preset with auto-detection support
  const applyNetworkPreset = useCallback(
    (preset, isAutoDetected = false) => {
      // If 'auto' is selected, use the detected preset or default to medium
      const actualPreset =
        preset === "auto" ? networkStats.detectedPreset || "medium" : preset;

      // Update the UI to show which preset is being used
      setNetworkPreset(isAutoDetected ? "auto" : preset);

      // Store in localStorage
      localStorage.setItem("networkPreset", isAutoDetected ? "auto" : preset);

      // Apply appropriate settings based on preset
      switch (actualPreset) {
        case "slow":
          setMaxParallelChunks(2);
          setChunkSize(2 * 1024 * 1024); // 2MB
          setUploadConcurrency(1);
          localStorage.setItem("maxParallelChunks", "2");
          localStorage.setItem("chunkSize", "2");
          localStorage.setItem("uploadConcurrency", "1");
          break;
        case "medium":
          setMaxParallelChunks(3);
          setChunkSize(5 * 1024 * 1024); // 5MB
          setUploadConcurrency(3);
          localStorage.setItem("maxParallelChunks", "3");
          localStorage.setItem("chunkSize", "5");
          localStorage.setItem("uploadConcurrency", "3");
          break;
        case "fast":
          setMaxParallelChunks(5);
          setChunkSize(10 * 1024 * 1024); // 10MB
          setUploadConcurrency(5);
          localStorage.setItem("maxParallelChunks", "5");
          localStorage.setItem("chunkSize", "10");
          localStorage.setItem("uploadConcurrency", "5");
          break;
        case "ultrafast":
          setMaxParallelChunks(10);
          setChunkSize(20 * 1024 * 1024); // 20MB
          setUploadConcurrency(8);
          localStorage.setItem("maxParallelChunks", "10");
          localStorage.setItem("chunkSize", "20");
          localStorage.setItem("uploadConcurrency", "8");
          break;
        default:
          // Medium is default
          setMaxParallelChunks(3);
          setChunkSize(5 * 1024 * 1024);
          setUploadConcurrency(3);
          localStorage.setItem("maxParallelChunks", "3");
          localStorage.setItem("chunkSize", "5");
          localStorage.setItem("uploadConcurrency", "3");
      }
    },
    [networkStats.detectedPreset]
  );

  // Function to update chunk size (exposed to UI)
  const setChunkSizeMB = useCallback((sizeMB) => {
    const sizeBytes = sizeMB * 1024 * 1024;
    setChunkSize(sizeBytes);
    localStorage.setItem("chunkSize", sizeMB.toString());
  }, []);

  // Function to update parallel chunks (exposed to UI)
  const updateMaxParallelChunks = useCallback((value) => {
    setMaxParallelChunks(value);
    localStorage.setItem("maxParallelChunks", value.toString());
  }, []);

  // Update uploadConcurrency with localStorage persistence
  const updateUploadConcurrency = useCallback((value) => {
    setUploadConcurrency(value);
    localStorage.setItem("uploadConcurrency", value.toString());
  }, []);

  // Prepare files for upload (add to selection)
  const prepareFiles = useCallback(
    (files) => {
      // Convert FileList to array
      const fileArray = Array.from(files);

      // Add unique ID to each file and prepare for tracking
      const preparedFiles = fileArray.map((file) => {
        const fileId = uuidv4();

        return {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          status: FILE_STATUS.PENDING,
          progress: 0,
          error: null,
          retryCount: 0,
          addedAt: new Date().toISOString(),
          // Store the original file for upload operations
          file: file,
        };
      });

      // Filter out duplicates based on name, size, and last modified date
      const newFiles = preparedFiles.filter((newFile) => {
        return !selectedFiles.some(
          (existingFile) =>
            existingFile.name === newFile.name &&
            existingFile.size === newFile.size &&
            existingFile.lastModified === newFile.lastModified
        );
      });

      // Update selected files state
      setSelectedFiles((prevFiles) => [...prevFiles, ...newFiles]);

      return newFiles;
    },
    [selectedFiles]
  );

  // Remove file from selection
  const removeFile = useCallback((fileId) => {
    setSelectedFiles((prevFiles) =>
      prevFiles.filter((file) => file.id !== fileId)
    );
  }, []);

  // Clear all selected files
  const clearSelectedFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  // Update file status and progress
  const updateFileStatus = useCallback(
    (fileId, status, progress = null, error = null) => {
      setSelectedFiles((prevFiles) =>
        prevFiles.map((file) => {
          if (file.id === fileId) {
            return {
              ...file,
              status,
              progress: progress !== null ? progress : file.progress,
              error: error !== null ? error : file.error,
              ...(status === FILE_STATUS.FAILED && {
                retryCount: file.retryCount + 1,
              }),
            };
          }
          return file;
        })
      );

      // Also update upload progress state for UI
      if (progress !== null) {
        setUploadProgress((prev) => ({
          ...prev,
          [fileId]: progress,
        }));
      }
    },
    []
  );

  // Function to upload a single chunk with retries
  const uploadChunk = useCallback(
    async (file, chunkIndex, start, end, uploadId, fileKey, totalChunks) => {
      const MAX_RETRIES = 3;
      let attempts = 0;

      while (attempts < MAX_RETRIES) {
        try {
          // Check if upload was cancelled (only check on first attempt or periodically)
          if (attempts === 0 || attempts % 2 === 0) {
            // First check local state
            const currentFile = selectedFiles.find((f) => f.id === file.id);
            if (currentFile?.status === FILE_STATUS.CANCELLED) {
              throw new Error("UPLOAD_CANCELLED");
            }

            // Check with server if the upload was cancelled (less frequently)
            if (chunkIndex % 5 === 0) {
              try {
                const statusResponse = await fetch("/api/upload-chunk", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    action: "status",
                    fileId: file.id,
                  }),
                });

                if (statusResponse.ok) {
                  const statusResult = await statusResponse.json();
                  if (statusResult.cancelled) {
                    throw new Error("UPLOAD_CANCELLED");
                  }
                }
              } catch (statusError) {
                if (statusError.message === "UPLOAD_CANCELLED")
                  throw statusError;
                console.warn("Error checking upload status:", statusError);
                // Continue with upload if we can't check status
              }
            }
          }

          // Slice the chunk from the file
          const chunk = file.file.slice(start, end);

          // Convert chunk to array buffer then to base64
          const fileArrayBuffer = await chunk.arrayBuffer();
          const base64Data = btoa(
            new Uint8Array(fileArrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          );

          // Upload this chunk
          const chunkResponse = await fetch("/api/upload-chunk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "upload",
              fileId: file.id,
              fileKey,
              uploadId,
              currentChunk: chunkIndex,
              totalChunks,
              chunkData: base64Data,
            }),
          });

          if (!chunkResponse.ok) {
            throw new Error(`HTTP error ${chunkResponse.status}`);
          }

          // Check the response to see if the server reports this upload as cancelled
          const chunkResult = await chunkResponse.json();
          if (chunkResult.cancelled) {
            throw new Error("UPLOAD_CANCELLED");
          }

          // Successfully uploaded this chunk
          return {
            chunkIndex,
            success: true,
          };
        } catch (error) {
          attempts++;

          // If upload was cancelled, don't retry
          if (error.message === "UPLOAD_CANCELLED") {
            throw error;
          }

          if (attempts >= MAX_RETRIES) {
            console.error(
              `Failed to upload chunk ${chunkIndex} after ${MAX_RETRIES} attempts:`,
              error
            );
            throw error;
          }

          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
          console.warn(
            `Retrying chunk ${chunkIndex} upload after ${delay}ms (attempt ${attempts})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    },
    [selectedFiles]
  );

  // Function to handle parallel chunk uploads for a single file
  const parallelChunkUpload = useCallback(
    async (file, uploadId, fileKey) => {
      try {
        const fileToUpload = file.file;
        const CHUNK_SIZE = chunkSize;
        const MAX_PARALLEL_CHUNKS = maxParallelChunks;

        const totalChunks = Math.ceil(fileToUpload.size / CHUNK_SIZE);
        const chunkResults = new Array(totalChunks).fill(null);
        let completedChunks = 0;

        // Record performance metrics
        const uploadStartTime = performance.now();

        // Process chunks in batches to limit concurrent connections
        for (
          let batchStart = 0;
          batchStart < totalChunks;
          batchStart += MAX_PARALLEL_CHUNKS
        ) {
          // Before starting each batch, check if the upload has been cancelled
          const currentFile = selectedFiles.find((f) => f.id === file.id);
          if (currentFile?.status === FILE_STATUS.CANCELLED) {
            throw new Error("UPLOAD_CANCELLED");
          }

          const batchEnd = Math.min(
            batchStart + MAX_PARALLEL_CHUNKS,
            totalChunks
          );
          const batchPromises = [];

          // Prepare the batch of chunk uploads
          for (
            let chunkIndex = batchStart;
            chunkIndex < batchEnd;
            chunkIndex++
          ) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileToUpload.size);

            batchPromises.push(
              uploadChunk(
                file,
                chunkIndex,
                start,
                end,
                uploadId,
                fileKey,
                totalChunks
              ).then((result) => {
                completedChunks++;
                chunkResults[chunkIndex] = result;

                // Update progress after each completed chunk
                const progress = Math.floor(
                  (completedChunks / totalChunks) * 100
                );
                updateFileStatus(file.id, FILE_STATUS.UPLOADING, progress);

                return result;
              })
            );
          }

          // Wait for all chunks in this batch to complete
          await Promise.all(batchPromises);
        }

        // Log performance metrics
        const uploadEndTime = performance.now();
        const uploadDuration = (uploadEndTime - uploadStartTime) / 1000; // in seconds
        const uploadSpeed = file.size / 1024 / 1024 / uploadDuration; // MB/s

        console.log(
          `File "${file.name}" (${(file.size / 1024 / 1024).toFixed(
            2
          )} MB) uploaded in ${uploadDuration.toFixed(2)} seconds`
        );
        console.log(`Average upload speed: ${uploadSpeed.toFixed(2)} MB/s`);
        console.log(
          `Using ${MAX_PARALLEL_CHUNKS} parallel chunks of ${(
            CHUNK_SIZE /
            1024 /
            1024
          ).toFixed(2)} MB each`
        );

        // Verify all chunks were uploaded successfully
        const allChunksSucceeded = chunkResults.every(
          (result) => result && result.success
        );

        if (!allChunksSucceeded) {
          const failedChunks = chunkResults
            .map((result, index) => ({ result, index }))
            .filter((item) => !item.result || !item.result.success);

          throw new Error(
            `Failed to upload all chunks. Failed chunks: ${failedChunks
              .map((f) => f.index)
              .join(", ")}`
          );
        }

        return true;
      } catch (error) {
        if (error.message === "UPLOAD_CANCELLED") {
          // This is an expected error for cancellation
          return false;
        }
        throw error;
      }
    },
    [selectedFiles, chunkSize, maxParallelChunks, uploadChunk, updateFileStatus]
  );

  // Function to update stats and history after a file completes
  const updateFileCompletion = useCallback(
    async (file, fileKey, fileUrl) => {
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
        url: fileUrl,
      });

      // Update stats immediately
      statsManager.updateSuccessStats(1, file.size);

      // Fetch updated stats to update UI
      const updatedStats = statsManager.getStats();
      setStats(updatedStats);

      // Refresh upload history
      const history = await uploadHistoryService.getHistory(1, 20);
      setUploadHistory(history.items);
    },
    [updateFileStatus]
  );

  // Enhanced startUpload function with parallel chunk uploads
  const startUpload = useCallback(async () => {
    if (selectedFiles.length === 0 || isUploading) return;

    setIsUploading(true);

    // Filter out files that are already uploaded or being uploaded
    const filesToUpload = selectedFiles.filter(
      (file) =>
        ![FILE_STATUS.COMPLETED, FILE_STATUS.UPLOADING].includes(file.status)
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
        fileId: id,
      }))
    );

    // Process files in batches based on concurrency
    let currentBatch = 0;
    const totalBatches = Math.ceil(filesToUpload.length / uploadConcurrency);

    // Record overall upload start time
    const batchStartTime = performance.now();

    const uploadBatch = async () => {
      const startIdx = currentBatch * uploadConcurrency;
      const endIdx = Math.min(
        startIdx + uploadConcurrency,
        filesToUpload.length
      );
      const currentFiles = filesToUpload.slice(startIdx, endIdx);

      if (currentFiles.length === 0) {
        // We're done with all batches
        const batchEndTime = performance.now();
        const totalTime = (batchEndTime - batchStartTime) / 1000;
        console.log(`All uploads completed in ${totalTime.toFixed(2)} seconds`);

        setIsUploading(false);
        return;
      }

      // Process files in current batch in parallel
      await Promise.allSettled(
        currentFiles.map(async (file) => {
          try {
            // Update file status to uploading
            updateFileStatus(file.id, FILE_STATUS.UPLOADING, 0);
            await uploadQueueService.updateStatus(
              file.id,
              FILE_STATUS.UPLOADING
            );

            // Get the actual File object
            const fileToUpload = file.file;

            // Make sure we have a valid File object
            if (!fileToUpload || !(fileToUpload instanceof File)) {
              throw new Error("Invalid file object");
            }

            // Initialize the chunked upload
            const initResponse = await fetch("/api/upload-chunk", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "initialize",
                fileId: file.id,
                fileName: file.name,
                fileType: file.type,
              }),
            });

            if (!initResponse.ok) {
              throw new Error(
                `Failed to initialize upload: HTTP ${initResponse.status}`
              );
            }

            const initResult = await initResponse.json();

            if (!initResult.success) {
              throw new Error(
                initResult.error || "Failed to initialize upload"
              );
            }

            const { uploadId, fileKey } = initResult;

            // Upload file chunks in parallel using our enhanced function
            const uploadSuccess = await parallelChunkUpload(
              file,
              uploadId,
              fileKey
            );

            // If upload was cancelled, don't proceed with completion
            if (!uploadSuccess) {
              return;
            }

            // One final check before completing
            const finalCheckFile = selectedFiles.find((f) => f.id === file.id);
            if (finalCheckFile?.status === FILE_STATUS.CANCELLED) {
              console.log(`Upload was cancelled before completion`);
              return;
            }

            // Complete the multipart upload
            const completeResponse = await fetch("/api/upload-chunk", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "complete",
                fileId: file.id,
                uploadId,
                fileKey,
              }),
            });

            if (!completeResponse.ok) {
              throw new Error(
                `Failed to complete upload: HTTP ${completeResponse.status}`
              );
            }

            const result = await completeResponse.json();

            if (!result.success) {
              throw new Error(result.error || "Failed to complete upload");
            }

            // Update stats, DB, and history immediately for this completed file
            await updateFileCompletion(file, result.key, result.url);
          } catch (error) {
            // Handle upload cancellation
            if (error.message === "UPLOAD_CANCELLED") {
              updateFileStatus(file.id, FILE_STATUS.CANCELLED);
              await uploadQueueService.updateStatus(
                file.id,
                FILE_STATUS.CANCELLED
              );
              return;
            }

            console.error(`Error uploading file ${file.name}:`, error);
            updateFileStatus(file.id, FILE_STATUS.FAILED, 0, error.message);
            await uploadQueueService.updateStatus(
              file.id,
              FILE_STATUS.FAILED,
              file.retryCount + 1
            );
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
  }, [
    selectedFiles,
    isUploading,
    uploadConcurrency,
    updateFileStatus,
    parallelChunkUpload,
    updateFileCompletion,
  ]);

  // Enhanced cancelUpload method to abort multipart uploads
  const cancelUpload = useCallback(
    async (fileId) => {
      // First update the local state to reflect cancellation
      updateFileStatus(fileId, FILE_STATUS.CANCELLED);
      await uploadQueueService.updateStatus(fileId, FILE_STATUS.CANCELLED);

      try {
        // Actively notify the server to abort the upload
        await fetch("/api/upload-chunk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "abort",
            fileId: fileId,
          }),
        });

        console.log(`Upload cancelled for file ID: ${fileId}`);
      } catch (error) {
        console.error("Error cancelling upload:", error);
        // Even if the server request fails, we still keep the local state as cancelled
      }
    },
    [updateFileStatus]
  );

  // Enhanced cancelAllUploads function
  const cancelAllUploads = useCallback(async () => {
    setIsUploading(false);

    // Get all files that are currently uploading
    const uploadingFiles = selectedFiles.filter(
      (file) => file.status === FILE_STATUS.UPLOADING
    );

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
      uploadingFiles.map((file) =>
        fetch("/api/upload-chunk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "abort",
            fileId: file.id,
          }),
        }).catch((error) =>
          console.error(`Error cancelling upload for ${file.name}:`, error)
        )
      )
    );

    console.log(`Cancelled ${uploadingFiles.length} uploads`);
  }, [selectedFiles, updateFileStatus]);

  // Retry failed uploads
  const retryFailedUploads = useCallback(() => {
    // Find all failed files
    const failedFiles = selectedFiles.filter(
      (file) => file.status === FILE_STATUS.FAILED
    );

    if (failedFiles.length === 0) return;

    // Reset their status to pending
    failedFiles.forEach((file) => {
      updateFileStatus(file.id, FILE_STATUS.PENDING, 0);
    });

    // Start upload again
    startUpload();
  }, [selectedFiles, updateFileStatus, startUpload]);

  // Process a folder
  const processFolder = useCallback(
    async (folderHandle) => {
      try {
        const files = [];

        // Recursive function to process directories
        async function processDirectoryEntry(dirHandle, path = "") {
          for await (const entry of dirHandle.values()) {
            const entryPath = path ? `${path}/${entry.name}` : entry.name;

            if (entry.kind === "file") {
              const file = await entry.getFile();
              // Create a new file with path information
              const fileWithPath = new File([file], entryPath, {
                type: file.type,
                lastModified: file.lastModified,
              });
              files.push(fileWithPath);
            } else if (entry.kind === "directory") {
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
        console.error("Error processing folder:", error);
        return 0;
      }
    },
    [prepareFiles]
  );

  // Value to be provided by the context
  const value = {
    // File states
    selectedFiles,
    uploadQueue,
    uploadHistory,
    stats,
    isUploading,
    uploadProgress,
    cloudProvider,

    // Upload performance configuration
    uploadConcurrency,
    maxParallelChunks,
    chunkSize: chunkSize / (1024 * 1024), // Convert bytes to MB for UI
    networkPreset,

    // Performance setting methods
    setUploadConcurrency: updateUploadConcurrency,
    setMaxParallelChunks: updateMaxParallelChunks,
    setChunkSize: setChunkSizeMB,
    applyNetworkPreset,

    // File management methods
    prepareFiles,
    removeFile,
    clearSelectedFiles,

    // Upload control methods
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
