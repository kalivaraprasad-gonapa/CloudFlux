import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploader } from '../contexts/UploaderContext';
import { dirPathManager } from '../lib/db';

const DropZone = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { prepareFiles, processFolder } = useUploader();

  // Handle dropped files
  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      prepareFiles(acceptedFiles);
    }
  }, [prepareFiles]);

  // Setup react-dropzone
  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    noClick: true,
    noKeyboard: true,
  });

  // Handle folder selection
  const handleFolderSelect = async () => {
    try {
      // Check if the directory picker API is supported
      if ('showDirectoryPicker' in window) {
        setIsProcessing(true);

        // Show directory picker - removed the invalid startIn value
        const dirHandle = await window.showDirectoryPicker({
          id: 's3-uploader-dir',
          // Only use startIn with valid values
          // Valid values are: 'desktop', 'documents', 'downloads', 'music', 'pictures', 'videos'
        });

        // Save selected directory for next time
        if (dirHandle.name) {
          dirPathManager.setLastPath(dirHandle.name);
        }

        // Process all files in the directory recursively
        const fileCount = await processFolder(dirHandle);

        // Show toast notification
        if (fileCount > 0) {
          // Could integrate with a toast notification system here
          console.log(`Added ${fileCount} files from folder`);
        }

        setIsProcessing(false);
      } else {
        alert('Folder selection is not supported in your browser. Try using Chrome, Edge, or other modern browsers.');
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      setIsProcessing(false);

      // If user canceled, don't show error
      if (error.name !== 'AbortError') {
        alert('Error selecting folder. Please try again.');
      }
    }
  };

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${isDragging
          ? 'border-primary bg-primary/10'
          : 'border-gray-300 hover:border-primary/50 hover:bg-secondary/50'
        }`}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="rounded-full bg-primary/10 p-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">
            Drop files here or <button onClick={open} className="text-primary hover:underline">browse</button>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Support for multiple files. Any file type accepted.
          </p>
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="btn btn-primary px-6"
          >
            Select Files
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleFolderSelect();
            }}
            disabled={isProcessing}
            className={`btn ${isProcessing ? 'btn-disabled' : 'btn-secondary'}`}
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Select Folder'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DropZone;