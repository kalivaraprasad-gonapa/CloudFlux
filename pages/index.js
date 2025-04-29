import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AccessForm from '../components/AccessForm';
import { sessionManager } from '../lib/db';

const Home = () => {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = () => {
      const isAuthenticated = sessionManager.checkSession();
      
      if (isAuthenticated) {
        // Redirect to uploader page
        router.push('/uploader');
      } else {
        // Show the access form
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

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
        <title>S3 File Uploader - Access</title>
        <meta name="description" content="Secure S3 file uploader" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <AccessForm />
    </>
  );
};

export default Home;