import Dexie from 'dexie';
import Cookies from 'js-cookie';

// Create IndexedDB instance with Dexie
export const db = new Dexie('s3UploaderDB');

// Database schema definition
db.version(1).stores({
  uploadHistory: '++id, fileName, fileSize, uploadDate, status, fileKey, url',
  uploadQueue: '++id, fileName, fileSize, fileType, addedAt, status, retryCount, fileId',
});

// Constants for local storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 's3-uploader-access-token',
  UPLOAD_STATS: 's3-uploader-stats',
  THEME_PREFERENCE: 's3-uploader-theme',
  LAST_UPLOAD_DIR: 's3-uploader-last-dir',
};

// Session management
export const sessionManager = {
  // Set authenticated session with expiry
  setSession: (token, expiryHours = 24) => {
    const expires = new Date(new Date().getTime() + expiryHours * 60 * 60 * 1000);
    Cookies.set(STORAGE_KEYS.ACCESS_TOKEN, token, { expires, secure: true, sameSite: 'strict' });
    return true;
  },
  
  // Check if session exists and is valid
  checkSession: () => {
    return !!Cookies.get(STORAGE_KEYS.ACCESS_TOKEN);
  },
  
  // Clear session
  clearSession: () => {
    Cookies.remove(STORAGE_KEYS.ACCESS_TOKEN);
    return true;
  }
};

// Upload stats manager
export const statsManager = {
  // Initialize or get existing stats
  getStats: () => {
    try {
      const stats = localStorage.getItem(STORAGE_KEYS.UPLOAD_STATS);
      if (!stats) {
        const initialStats = {
          totalUploaded: 0,
          totalSize: 0,
          successCount: 0,
          failedCount: 0,
          lastUploadDate: null,
        };
        localStorage.setItem(STORAGE_KEYS.UPLOAD_STATS, JSON.stringify(initialStats));
        return initialStats;
      }
      return JSON.parse(stats);
    } catch (error) {
      console.error('Error accessing upload stats:', error);
      return {
        totalUploaded: 0,
        totalSize: 0,
        successCount: 0,
        failedCount: 0,
        lastUploadDate: null,
      };
    }
  },
  
  // Update stats after successful upload
  updateSuccessStats: (fileCount, totalSize) => {
    try {
      const stats = statsManager.getStats();
      const updatedStats = {
        ...stats,
        totalUploaded: stats.totalUploaded + fileCount,
        totalSize: stats.totalSize + totalSize,
        successCount: stats.successCount + fileCount,
        lastUploadDate: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.UPLOAD_STATS, JSON.stringify(updatedStats));
      return updatedStats;
    } catch (error) {
      console.error('Error updating success stats:', error);
      return null;
    }
  },
  
  // Update stats after failed upload
  updateFailureStats: (fileCount) => {
    try {
      const stats = statsManager.getStats();
      const updatedStats = {
        ...stats,
        failedCount: stats.failedCount + fileCount,
        lastUploadDate: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.UPLOAD_STATS, JSON.stringify(updatedStats));
      return updatedStats;
    } catch (error) {
      console.error('Error updating failure stats:', error);
      return null;
    }
  },
  
  // Reset stats
  resetStats: () => {
    try {
      const initialStats = {
        totalUploaded: 0,
        totalSize: 0,
        successCount: 0,
        failedCount: 0,
        lastUploadDate: null,
      };
      localStorage.setItem(STORAGE_KEYS.UPLOAD_STATS, JSON.stringify(initialStats));
      return initialStats;
    } catch (error) {
      console.error('Error resetting stats:', error);
      return null;
    }
  }
};

// Theme preference manager
export const themeManager = {
  getTheme: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE) || 'system';
    } catch (error) {
      return 'system';
    }
  },
  
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME_PREFERENCE, theme);
      return true;
    } catch (error) {
      console.error('Error setting theme preference:', error);
      return false;
    }
  }
};

// Last directory path manager
export const dirPathManager = {
  getLastPath: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_UPLOAD_DIR) || '';
    } catch (error) {
      return '';
    }
  },
  
  setLastPath: (path) => {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_UPLOAD_DIR, path);
      return true;
    } catch (error) {
      console.error('Error saving last directory path:', error);
      return false;
    }
  }
};

// Upload history service
export const uploadHistoryService = {
  // Add new upload to history
  addToHistory: async (fileData) => {
    try {
      const id = await db.uploadHistory.add({
        ...fileData,
        uploadDate: new Date().toISOString()
      });
      return id;
    } catch (error) {
      console.error('Error adding to upload history:', error);
      return null;
    }
  },
  
  // Get upload history with pagination
  getHistory: async (page = 1, limit = 50) => {
    try {
      const offset = (page - 1) * limit;
      const history = await db.uploadHistory
        .orderBy('uploadDate')
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray();
      
      const totalCount = await db.uploadHistory.count();
      
      return {
        items: history,
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit)
      };
    } catch (error) {
      console.error('Error fetching upload history:', error);
      return {
        items: [],
        total: 0,
        page: 1,
        pages: 0
      };
    }
  },
  
  // Clear upload history
  clearHistory: async () => {
    try {
      await db.uploadHistory.clear();
      return true;
    } catch (error) {
      console.error('Error clearing upload history:', error);
      return false;
    }
  }
};

// Upload queue service
export const uploadQueueService = {
  // Add files to queue
  addToQueue: async (files) => {
    try {
      const fileEntries = files.map(file => ({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        addedAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        fileId: file.id || crypto.randomUUID()
      }));
      
      const ids = await db.uploadQueue.bulkAdd(fileEntries);
      return ids;
    } catch (error) {
      console.error('Error adding to upload queue:', error);
      return [];
    }
  },
  
  // Update file status in queue
  updateStatus: async (fileId, status, retryCount = null) => {
    try {
      const updates = { status };
      if (retryCount !== null) {
        updates.retryCount = retryCount;
      }
      
      await db.uploadQueue
        .where({ fileId })
        .modify(updates);
      
      return true;
    } catch (error) {
      console.error('Error updating file status in queue:', error);
      return false;
    }
  },
  
  // Get all items in the queue
  getQueue: async () => {
    try {
      const queue = await db.uploadQueue.toArray();
      return queue;
    } catch (error) {
      console.error('Error fetching upload queue:', error);
      return [];
    }
  },
  
  // Remove item from queue
  removeFromQueue: async (fileId) => {
    try {
      await db.uploadQueue
        .where({ fileId })
        .delete();
      
      return true;
    } catch (error) {
      console.error('Error removing file from queue:', error);
      return false;
    }
  },
  
  // Clear all completed uploads from queue
  clearCompleted: async () => {
    try {
      await db.uploadQueue
        .where('status')
        .equals('completed')
        .delete();
      
      return true;
    } catch (error) {
      console.error('Error clearing completed uploads:', error);
      return false;
    }
  },
  
  // Clear entire queue
  clearQueue: async () => {
    try {
      await db.uploadQueue.clear();
      return true;
    } catch (error) {
      console.error('Error clearing upload queue:', error);
      return false;
    }
  }
};

export default {
  db,
  sessionManager,
  statsManager,
  themeManager,
  dirPathManager,
  uploadHistoryService,
  uploadQueueService
};