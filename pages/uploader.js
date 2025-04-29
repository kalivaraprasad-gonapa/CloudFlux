import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import DropZone from '../components/DropZone';
import FileList from '../components/FileList';
import UploadStats from '../components/UploadStats';
import { useUploader } from '../contexts/UploaderContext';
import { sessionManager } from '../lib/db';

const UploaderPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { cloudProvider } = useUploader();

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = () => {
      const isAuthenticated = sessionManager.checkSession();
      
      if (!isAuthenticated) {
        // Redirect to home page for authentication
        router.push('/');
      } else {
        // Show the uploader
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  // Handle logout
  const handleLogout = () => {
    sessionManager.clearSession();
    router.push('/');
  };

  // Get cloud provider name
  const getCloudProviderName = () => {
    if (cloudProvider === 'aws') {
      return 'Amazon S3';
    } else if (cloudProvider === 'gcp') {
      return 'Google Cloud Storage';
    } else {
      return 'Cloud Storage';
    }
  };

  // Get cloud provider icon
  const getCloudIcon = () => {
    if (cloudProvider === 'aws') {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z" />
        </svg>
      );
    } else if (cloudProvider === 'gcp') {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a9.321 9.321 0 0 0 9.282 7.013 9.341 9.341 0 0 0 9.232-6.981l.002.007v-.002a9.203 9.203 0 0 0 0-10.974l.002.003v-.004a9.323 9.323 0 0 0-9.036-6.92zm5.99 18.297c-.7.74-1.631 1.25-2.562 1.637-2.762 1.152-5.1.284-5.977-.295-1.9-1.246-3.716-3.502-3.133-7.621.916-6.505 6.145-7.067 7.397-7.136 1.242-.074 5.577-.094 7.715 4.421.884 1.866.664 5.785-3.44 8.994z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
        </svg>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-secondary to-white dark:from-gray-800 dark:to-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Cloud File Uploader</title>
        <meta name="description" content="Upload files directly to cloud storage" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-primary dark:text-primary-light">
                  Cloud File Uploader
                </h1>
                <div className="ml-4 flex items-center px-3 py-1 bg-secondary dark:bg-gray-700 rounded-full">
                  <span className="text-primary dark:text-primary-light mr-2">
                    {getCloudIcon()}
                  </span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {getCloudProviderName()}
                  </span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            {/* Upload stats */}
            <section>
              <UploadStats />
            </section>
            
            {/* Drop Zone */}
            <section>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Upload Files
              </h2>
              <DropZone />
            </section>
            
            {/* File List */}
            <section>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Selected Files
              </h2>
              <FileList />
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-gray-800 shadow mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              Cloud File Uploader &copy; {new Date().getFullYear()}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default UploaderPage;