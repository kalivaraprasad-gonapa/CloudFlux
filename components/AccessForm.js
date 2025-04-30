import React, { useState } from "react";
import { useRouter } from "next/router";
import { sessionManager } from "../lib/db";

const AccessForm = () => {
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!secretKey.trim()) {
      setError("Please enter the secret key");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ secretKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      // Save to session
      sessionManager.setSession(data.token);

      // Redirect to uploader page
      router.push("/uploader");
    } catch (error) {
      console.error("Auth error:", error);
      setError(error.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-secondary to-white dark:from-gray-800 dark:to-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary dark:text-primary-light mb-2">
            S3 File Uploader
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Enter the secret key to access the uploader
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="secretKey"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Secret Key
            </label>
            <input
              type="password"
              id="secretKey"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="Enter your secret key"
              className="input w-full"
              autoComplete="off"
              disabled={isLoading}
            />
            {error && <p className="mt-2 text-sm text-error">{error}</p>}
          </div>

          <button
            type="submit"
            className={`w-full ${
              isLoading ? "btn-disabled" : "btn-primary"
            } btn`}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Verifying...
              </span>
            ) : (
              "Access Uploader"
            )}
          </button>
        </form>
      </div>

      <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        No account required. Only authorized users with the correct key can
        access.
      </p>
    </div>
  );
};

export default AccessForm;
