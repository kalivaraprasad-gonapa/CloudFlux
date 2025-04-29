import React, { useMemo } from 'react';
import { useUploader, FILE_STATUS } from '../contexts/UploaderContext';
import FileItem from './FileItem';

const FileList = () => {
  const { 
    selectedFiles, 
    clearSelectedFiles, 
    isUploading, 
    startUpload,
    cancelAllUploads,
    retryFailedUploads
  } = useUploader();
  
  // Calculate stats for selected files
  const stats = useMemo(() => {
    if (selectedFiles.length === 0) return null;
    
    const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
    const pendingCount = selectedFiles.filter(file => file.status === FILE_STATUS.PENDING).length;
    const uploadingCount = selectedFiles.filter(file => file.status === FILE_STATUS.UPLOADING).length;
    const completedCount = selectedFiles.filter(file => file.status === FILE_STATUS.COMPLETED).length;
    const failedCount = selectedFiles.filter(file => file.status === FILE_STATUS.FAILED).length;
    
    return {
      totalSize,
      pendingCount,
      uploadingCount,
      completedCount,
      failedCount,
    };
  }, [selectedFiles]);
  
  // Format total size
  const formatTotalSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Determine if upload button should be enabled
  const canUpload = useMemo(() => {
    return !isUploading && selectedFiles.length > 0 && (stats?.pendingCount > 0 || stats?.failedCount > 0);
  }, [isUploading, selectedFiles, stats]);
  
  // Determine if clear button should be enabled
  const canClear = useMemo(() => {
    return !isUploading && selectedFiles.length > 0;
  }, [isUploading, selectedFiles]);
  
  // Determine if retry button should be shown
  const showRetry = useMemo(() => {
    return stats?.failedCount > 0;
  }, [stats]);
  
  if (selectedFiles.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <p>No files selected for upload</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* File selection stats */}
      <div className="bg-secondary dark:bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Files</h3>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {selectedFiles.length} files ({formatTotalSize(stats?.totalSize || 0)})
            </div>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              {stats?.pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {stats.pendingCount} pending
                </span>
              )}
              {stats?.uploadingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {stats.uploadingCount} uploading
                </span>
              )}
              {stats?.completedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-success/10 text-success">
                  {stats.completedCount} completed
                </span>
              )}
              {stats?.failedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-error/10 text-error">
                  {stats.failedCount} failed
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {showRetry && (
              <button
                type="button"
                onClick={retryFailedUploads}
                disabled={isUploading}
                className={`btn ${isUploading ? 'btn-disabled' : 'btn-secondary'} text-sm py-1.5`}
              >
                Retry Failed
              </button>
            )}
            
            <button
              type="button"
              onClick={isUploading ? cancelAllUploads : startUpload}
              disabled={!canUpload && !isUploading}
              className={`btn ${
                isUploading 
                  ? 'btn-error' 
                  : !canUpload 
                    ? 'btn-disabled' 
                    : 'btn-primary'
              } text-sm py-1.5`}
            >
              {isUploading ? 'Cancel Uploads' : 'Upload Files'}
            </button>
            
            <button
              type="button"
              onClick={clearSelectedFiles}
              disabled={!canClear}
              className={`btn ${!canClear ? 'btn-disabled' : 'btn-secondary'} text-sm py-1.5`}
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
      
      {/* File list */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {selectedFiles.map((file) => (
          <FileItem key={file.id} file={file} />
        ))}
      </div>
    </div>
  );
};

export default FileList;