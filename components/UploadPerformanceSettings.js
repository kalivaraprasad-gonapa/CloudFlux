// components/UploadPerformanceSettings.js
import React, { useState, useEffect, useCallback } from "react";
import { useUploader } from "../contexts/UploaderContext";

// Helper function to format network speed description
const getNetworkSpeedDescription = (preset) => {
  switch (preset) {
    case "slow":
      return "Best for mobile connections, weak WiFi";
    case "medium":
      return "Best for average home internet";
    case "fast":
      return "Best for high-speed broadband";
    case "ultrafast":
      return "Best for fiber optic connections";
    case "auto":
      return "Automatically adjusted based on your connection";
    default:
      return "Standard upload settings";
  }
};

const UploadPerformanceSettings = () => {
  const {
    uploadConcurrency,
    setUploadConcurrency,
    maxParallelChunks,
    setMaxParallelChunks,
    chunkSize,
    setChunkSize,
    networkPreset,
    applyNetworkPreset,
    isUploading,
  } = useUploader();

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isTestingNetwork, setIsTestingNetwork] = useState(false);
  const [networkStats, setNetworkStats] = useState({
    downlink: 0,
    rtt: 0,
    effectiveType: "",
    networkType: "",
    lastTested: null,
    detectedPreset: "medium",
  });

  // Show memory usage warning when settings might use too much memory
  const estimatedMemoryUsage =
    chunkSize * maxParallelChunks * uploadConcurrency;
  const isHighMemoryUsage = estimatedMemoryUsage > 150; // More than ~150MB

  // Function to test network speed using Navigation API and fetch
  const testNetworkSpeed = useCallback(async () => {
    setIsTestingNetwork(true);

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
          downlink: navigator.connection.downlink || 0,
          rtt: navigator.connection.rtt || 0,
          effectiveType: navigator.connection.effectiveType || "unknown",
          networkType: navigator.connection.type || "unknown",
        };
      }

      const testSizeKB = 200; // Test payload size
      const iterations = 3;
      let totalUploadTime = 0;
      let totalBytes = 0;

      for (let i = 0; i < iterations; i++) {
        const payload = new Blob([new ArrayBuffer(testSizeKB * 1024)]);
        const startTime = performance.now();

        const response = await fetch("/api/network-test", {
          method: "POST",
          body: payload,
        });

        const endTime = performance.now();
        const duration = endTime - startTime;
        totalUploadTime += duration;

        if (response.ok) {
          const result = await response.json();
          totalBytes += result.received || payload.size;
        } else {
          console.warn("Network test failed on iteration", i + 1);
        }
      }

      const avgUploadTime = totalUploadTime / iterations;
      const uploadSpeedMbps =
        (totalBytes * 8) / (1024 * 1024) / (avgUploadTime / 1000);

      // Determine network preset
      let detectedPreset = "medium";
      if (uploadSpeedMbps > 50 && connectionInfo.rtt < 50) {
        detectedPreset = "ultrafast";
      } else if (uploadSpeedMbps > 20 && connectionInfo.rtt < 100) {
        detectedPreset = "fast";
      } else if (uploadSpeedMbps > 5 && connectionInfo.rtt < 200) {
        detectedPreset = "medium";
      } else {
        detectedPreset = "slow";
      }

      setNetworkStats({
        ...connectionInfo,
        uploadSpeedMbps: uploadSpeedMbps.toFixed(2),
        lastTested: new Date(),
        detectedPreset,
      });

      if (networkPreset === "auto") {
        applyNetworkPreset(detectedPreset);
      }

      return detectedPreset;
    } catch (error) {
      console.error("Error testing network speed:", error);
      return "medium";
    } finally {
      setIsTestingNetwork(false);
    }
  }, [applyNetworkPreset, networkPreset]);

  // Apply auto settings when component mounts or when the mode changes
  useEffect(() => {
    // Only run network test on first load or if auto is selected
    if (
      networkPreset === "auto" &&
      (!networkStats.lastTested ||
        (networkStats.lastTested &&
          new Date() - networkStats.lastTested > 300000))
    ) {
      // Re-test every 5 minutes
      testNetworkSpeed();
    }
  }, [networkPreset, networkStats.lastTested, testNetworkSpeed]);

  // Handle applying network preset including auto mode
  const handleApplyNetworkPreset = (preset) => {
    if (preset === "auto") {
      // Set to auto mode, which will run network test
      applyNetworkPreset(networkStats.detectedPreset || "medium");
      testNetworkSpeed();
    } else {
      // Apply a specific preset
      applyNetworkPreset(preset);
    }
  };

  // Format the last tested time
  const formatLastTested = (date) => {
    if (!date) return "Never";

    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Upload Performance
          </h2>
          <div className="flex items-center ml-3 px-3 py-1 bg-secondary dark:bg-gray-700 rounded-full">
            <span className="text-xs text-gray-700 dark:text-gray-300">
              {isUploading
                ? "Uploading..."
                : networkPreset === "auto"
                ? "Auto"
                : networkPreset}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={testNetworkSpeed}
            disabled={isTestingNetwork || isUploading}
            className={`text-sm px-3 py-1 rounded ${
              isTestingNetwork
                ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
            }`}
          >
            {isTestingNetwork ? "Testing..." : "Test Network"}
          </button>
          <button
            type="button"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="text-sm text-primary hover:text-primary-dark"
          >
            {showAdvancedSettings ? "Hide Advanced" : "Show Advanced"}
          </button>
        </div>
      </div>

      {/* Network Stats */}
      {networkStats.lastTested && (
        <div className="mb-4 bg-secondary dark:bg-gray-700 rounded-lg p-4">
          <div className="flex flex-wrap gap-4 sm:gap-6 items-center">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Upload Speed
              </p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {networkStats.uploadSpeedMbps} Mbps
              </p>
            </div>
            {networkStats.downlink > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Download
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {networkStats.downlink} Mbps
                </p>
              </div>
            )}
            {networkStats.rtt > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Latency
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {networkStats.rtt} ms
                </p>
              </div>
            )}
            {networkStats.effectiveType !== "unknown" && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Connection
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {networkStats.effectiveType}
                </p>
              </div>
            )}
            <div className="ml-auto">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last Tested
              </p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {formatLastTested(networkStats.lastTested)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Network Presets */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
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
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Network Speed Preset
            </p>
            <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
              {getNetworkSpeedDescription(
                networkPreset === "auto" ? "auto" : networkPreset
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 mt-3">
          <button
            className={`px-2 py-2 text-sm rounded-md transition ${
              networkPreset === "auto"
                ? "bg-primary text-white"
                : "bg-secondary dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
            onClick={() => handleApplyNetworkPreset("auto")}
            disabled={isUploading}
          >
            Auto
          </button>
          <button
            className={`px-2 py-2 text-sm rounded-md transition ${
              networkPreset === "slow"
                ? "bg-primary text-white"
                : "bg-secondary dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
            onClick={() => handleApplyNetworkPreset("slow")}
            disabled={isUploading}
          >
            Slow
          </button>
          <button
            className={`px-2 py-2 text-sm rounded-md transition ${
              networkPreset === "medium"
                ? "bg-primary text-white"
                : "bg-secondary dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
            onClick={() => handleApplyNetworkPreset("medium")}
            disabled={isUploading}
          >
            Medium
          </button>
          <button
            className={`px-2 py-2 text-sm rounded-md transition ${
              networkPreset === "fast"
                ? "bg-primary text-white"
                : "bg-secondary dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
            onClick={() => handleApplyNetworkPreset("fast")}
            disabled={isUploading}
          >
            Fast
          </button>
          <button
            className={`px-2 py-2 text-sm rounded-md transition ${
              networkPreset === "ultrafast"
                ? "bg-primary text-white"
                : "bg-secondary dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
            onClick={() => handleApplyNetworkPreset("ultrafast")}
            disabled={isUploading}
          >
            Ultra-Fast
          </button>
        </div>
      </div>

      {showAdvancedSettings && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* File Concurrency Setting */}
            <div className="bg-secondary dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-2">
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
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Concurrent Files
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {uploadConcurrency}
                  </p>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={uploadConcurrency}
                onChange={(e) => setUploadConcurrency(Number(e.target.value))}
                disabled={isUploading || networkPreset === "auto"}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Less</span>
                <span>More</span>
              </div>
            </div>

            {/* Chunk Parallelism Setting */}
            <div className="bg-secondary dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-2">
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
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Parallel Chunks
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {maxParallelChunks}
                  </p>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                value={maxParallelChunks}
                onChange={(e) => setMaxParallelChunks(Number(e.target.value))}
                disabled={isUploading || networkPreset === "auto"}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Less</span>
                <span>More</span>
              </div>
            </div>

            {/* Chunk Size Setting */}
            <div className="bg-secondary dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <div className="rounded-md bg-purple-100 dark:bg-purple-900/20 p-2 mr-4">
                  <svg
                    className="w-6 h-6 text-purple-500"
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
                    Chunk Size
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {chunkSize} MB
                  </p>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                disabled={isUploading || networkPreset === "auto"}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Smaller</span>
                <span>Larger</span>
              </div>
            </div>
          </div>

          {/* Memory Usage Indicator */}
          <div className="mt-4 bg-secondary dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <div
                className={`rounded-md ${
                  isHighMemoryUsage ? "bg-error/20" : "bg-success/20"
                } p-2 mr-4`}
              >
                <svg
                  className={`w-6 h-6 ${
                    isHighMemoryUsage ? "text-error" : "text-success"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      isHighMemoryUsage
                        ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    }
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Estimated Memory Usage
                </p>
                <p
                  className={`text-base font-semibold ${
                    isHighMemoryUsage
                      ? "text-error"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  ~{Math.round(estimatedMemoryUsage)} MB
                </p>
              </div>
            </div>

            {isHighMemoryUsage && (
              <div className="mt-2 text-xs text-error">
                These settings might use a lot of memory. Consider reducing
                parallel chunks or concurrent files if you experience
                performance issues.
              </div>
            )}

            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mt-3">
              <div
                className={`h-2.5 rounded-full ${
                  estimatedMemoryUsage > 200
                    ? "bg-error"
                    : estimatedMemoryUsage > 100
                    ? "bg-warning"
                    : "bg-success"
                }`}
                style={{
                  width: `${Math.min(estimatedMemoryUsage / 3, 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {networkPreset === "auto" && (
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-600 dark:text-blue-300">
          <div className="flex items-center">
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              ></path>
            </svg>
            Auto mode is active. Performance settings are optimized based on
            your network conditions.
          </div>
        </div>
      )}

      {isUploading && (
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-600 dark:text-blue-300">
          <div className="flex items-center">
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              ></path>
            </svg>
            Performance settings cannot be changed during active uploads
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPerformanceSettings;
