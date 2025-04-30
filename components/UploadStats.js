import React from "react";
import { useUploader } from "../contexts/UploaderContext";
import { statsManager } from "../lib/db";

// Helper function to format bytes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return "Never";

  const date = new Date(dateString);
  return date.toLocaleString();
};

// Helper to get cloud provider icon
const getCloudIcon = (provider) => {
  if (provider === "aws") {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.272-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.383.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z" />
      </svg>
    );
  } else if (provider === "gcp") {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a9.321 9.321 0 0 0 9.282 7.013 9.341 9.341 0 0 0 9.232-6.981l.002.007v-.002a9.203 9.203 0 0 0 0-10.974l.002.003v-.004a9.323 9.323 0 0 0-9.036-6.92zm5.99 18.297c-.7.74-1.631 1.25-2.562 1.637-2.762 1.152-5.1.284-5.977-.295-1.9-1.246-3.716-3.502-3.133-7.621.916-6.505 6.145-7.067 7.397-7.136 1.242-.074 5.577-.094 7.715 4.421.884 1.866.664 5.785-3.44 8.994z" />
        <path d="M15.67 7.813l-.213.434c.58-.144 1.63.215 1.63 1.302 0 .5-.311.993-.76 1.357l.434-.17c.5-.391.707-.954.707-1.439-.002-.397-.157-1.347-1.798-1.484zm-.191.17c.408 0 .814.116 1.145.338-.231-.032-1.03-.041-1.5.695-.071.11-.075.318-.027.471.109.359.41.609.782.632.33.019.573-.059.762-.16-.183.207-.457.327-.762.345-.5 0-.993-.301-1.2-.785-.135-.332-.135-.67.049-.964.243-.426.662-.572 1.086-.572h.665zm-.086.514c-.2 0-.394.104-.508.284-.155.242-.108.498.047.75.19.359.547.583.953.583.017-.5.207.029 0 0 .136-.08.035-.005 0 0-.5.064-.071.064-.136.064-.324 0-.993-.32-.993-1.004 0-.324.24-.677.602-.677.365 0 .5.338.5.338v.188c0 .002.108-.526-.465-.526zm1.936 1.27l-.351.136c.313.07.565.391.565.756s-.252.69-.565.751l.351.14c.391-.17.622-.537.622-.891 0-.36-.238-.72-.622-.892zm-1.366.1h-.161v1.562h.161zm1.558.247c-.149 0-.27.121-.27.271 0 .149.121.27.27.27s.27-.121.27-.27c0-.15-.121-.271-.27-.271zm-1.559.126h.189v.982h-.189zm1.559.019c-.072 0-.131.059-.131.131 0 .071.059.13.131.13.071 0 .131-.059.131-.13 0-.072-.06-.131-.131-.131zm-2.589.038h-.184v.984h.184z" />
      </svg>
    );
  } else {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
      </svg>
    );
  }
};

// Helper to get cloud provider name
const getCloudProviderName = (provider) => {
  if (provider === "aws") {
    return "Amazon S3";
  } else if (provider === "gcp") {
    return "Google Cloud Storage";
  } else {
    return "Cloud Storage";
  }
};

const UploadStats = () => {
  const { stats, cloudProvider } = useUploader();

  const handleReset = () => {
    if (
      window.confirm("Are you sure you want to reset all upload statistics?")
    ) {
      statsManager.resetStats();
      window.location.reload();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Upload Statistics
          </h2>
          <div className="flex items-center ml-3 px-3 py-1 bg-secondary dark:bg-gray-700 rounded-full">
            <span className="text-primary dark:text-primary-light mr-2">
              {getCloudIcon(cloudProvider)}
            </span>
            <span className="text-xs text-gray-700 dark:text-gray-300">
              {getCloudProviderName(cloudProvider)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-primary hover:text-primary-dark"
        >
          Reset Stats
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-secondary dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center">
            <div className="rounded-md bg-primary/20 p-2 mr-4">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Files Uploaded
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats.totalUploaded}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-secondary dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center">
            <div className="rounded-md bg-blue-100 dark:bg-blue-900/20 p-2 mr-4">
              <svg
                className="w-6 h-6 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Size Uploaded
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {formatBytes(stats.totalSize)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-secondary dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center">
            <div className="rounded-md bg-green-100 dark:bg-green-900/20 p-2 mr-4">
              <svg
                className="w-6 h-6 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last Upload
              </p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {formatDate(stats.lastUploadDate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="bg-secondary dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center">
            <div className="rounded-md bg-success/20 p-2 mr-4">
              <svg
                className="w-6 h-6 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Successful Uploads
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats.successCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-secondary dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center">
            <div className="rounded-md bg-error/20 p-2 mr-4">
              <svg
                className="w-6 h-6 text-error"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Failed Uploads
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats.failedCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {stats.totalUploaded > 0 && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-success h-2.5 rounded-full"
              style={{
                width: `${
                  stats.totalUploaded > 0
                    ? (stats.successCount / stats.totalUploaded) * 100
                    : 0
                }%`,
              }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Success Rate</span>
            <span>
              {stats.totalUploaded > 0
                ? Math.round((stats.successCount / stats.totalUploaded) * 100)
                : 0}
              %
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadStats;
