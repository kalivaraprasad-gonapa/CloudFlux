import React, { useMemo } from 'react';
import { FILE_STATUS, useUploader } from '../contexts/UploaderContext';

// Helper function to format file size
const formatFileSize = (bytes) => {
    if (bytes === 0 || typeof bytes !== 'number' || isNaN(bytes)) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to get file icon based on type
const getFileIcon = (fileType) => {
    if (!fileType || typeof fileType !== 'string') {
        // Default icon for when file type is undefined or not a string
        return (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        );
    }

    if (fileType.includes('image/')) {
        return (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        );
    } else if (fileType.includes('video/')) {
        return (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
        );
    } else if (fileType.includes('audio/')) {
        return (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
        );
    } else if (fileType.includes('application/pdf')) {
        return (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        );
    } else if (fileType.includes('application/zip') || fileType.includes('application/x-rar-compressed')) {
        return (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
        );
    } else {
        return (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        );
    }
};

// Get status icon based on file status
const getStatusIcon = (status) => {
    switch (status) {
        case FILE_STATUS.COMPLETED:
            return (
                <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            );
        case FILE_STATUS.FAILED:
            return (
                <svg className="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            );
        case FILE_STATUS.UPLOADING:
            return (
                <svg className="w-5 h-5 text-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            );
        case FILE_STATUS.CANCELLED:
            return (
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        case FILE_STATUS.PAUSED:
            return (
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        default:
            return (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
    }
};

const FileItem = ({ file }) => {
    // Validate that file object exists
    if (!file || typeof file !== 'object') {
        console.error('Invalid file object provided to FileItem:', file);
        return <div className="p-3 text-error">Invalid file data</div>;
    }

    const { removeFile, cancelUpload, updateFileStatus, uploadProgress } = useUploader();

    // Get proper progress value with better error handling
    const progress = useMemo(() => {
        // First check uploadProgress which comes from the network
        const progressValue = uploadProgress && file?.id ? uploadProgress[file.id] : null;
        if (typeof progressValue === 'number' && !isNaN(progressValue)) {
            return progressValue;
        }
        // Fallback to file's internal progress
        return (typeof file.progress === 'number' && !isNaN(file.progress)) ? file.progress : 0;
    }, [file, uploadProgress]);

    // Format file name with path if it exists with better validation
    const displayName = useMemo(() => {
        // Make sure we have a valid file name
        const fileName = file.name || 'Unnamed File';
        
        // Only process path if we have a valid string with path separators
        if (typeof fileName === 'string' && fileName.includes('/')) {
            // File is from a folder upload
            const parts = fileName.split('/');
            const name = parts.pop() || 'Unnamed File';
            const folderPath = parts.join('/');

            return (
                <div className="flex flex-col">
                    <span className="truncate">{name}</span>
                    <span className="text-xs text-gray-500 truncate">{folderPath}</span>
                </div>
            );
        }

        return <span className="truncate">{fileName}</span>;
    }, [file?.name]);

    // Handle retry of failed upload
    const handleRetry = () => {
        if (file?.id) {
            updateFileStatus(file.id, FILE_STATUS.PENDING, 0);
        }
    };

    // Handle removing file from selection
    const handleRemove = () => {
        if (!file?.id) return;
        
        if (file.status === FILE_STATUS.UPLOADING) {
            cancelUpload(file.id);
        }
        removeFile(file.id);
    };

    // Determine if cancel/remove button should be disabled
    const isActionDisabled = file.status === FILE_STATUS.COMPLETED;

    // Safe file size
    const fileSize = typeof file.size === 'number' && !isNaN(file.size) ? file.size : 0;

    return (
        <div className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {/* File icon */}
            <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                {getFileIcon(file.type)}
            </div>

            {/* File info */}
            <div className="flex-grow min-w-0">
                {/* File name */}
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {displayName}
                </div>

                {/* File size */}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(fileSize)}
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full ${file.status === FILE_STATUS.FAILED
                                ? 'bg-error'
                                : file.status === FILE_STATUS.COMPLETED
                                    ? 'bg-success'
                                    : file.status === FILE_STATUS.UPLOADING
                                        ? 'animated-progress-bar'
                                        : 'bg-primary'
                            }`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>

                {/* Error message if failed */}
                {file.status === FILE_STATUS.FAILED && file.error && (
                    <div className="mt-1 text-xs text-error">
                        Error: {file.error}
                    </div>
                )}
            </div>

            {/* Status */}
            <div className="flex-shrink-0">
                {getStatusIcon(file.status)}
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex space-x-2">
                {file.status === FILE_STATUS.FAILED && (
                    <button
                        type="button"
                        onClick={handleRetry}
                        className="p-1 text-primary hover:bg-primary/10 rounded-full"
                        title="Retry upload"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                )}

                <button
                    type="button"
                    onClick={handleRemove}
                    disabled={isActionDisabled}
                    className={`p-1 rounded-full ${isActionDisabled
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    title={file.status === FILE_STATUS.UPLOADING ? 'Cancel upload' : 'Remove'}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default FileItem;