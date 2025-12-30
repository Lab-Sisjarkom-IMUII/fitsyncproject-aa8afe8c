'use client';

import { useEffect } from 'react';
import Navbar from '@/components/Navbar';

export default function OfflinePage() {
  useEffect(() => {
    // Try to detect when we come back online
    const handleOnline = () => {
      // Optionally redirect to home when back online
      if (navigator.onLine) {
        window.location.href = '/';
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0E0E12] text-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="text-center">
          <div className="mx-auto w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">You're Offline</h1>
          <p className="text-lg text-[#A0A3A8] mb-8 max-w-md mx-auto">
            It looks like you're not connected to the internet. Some features may be unavailable until you reconnect.
          </p>
          <div className="flex flex-col items-center">
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#00FFAA] hover:bg-[#00E699] text-[#0E0E12] font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
            <p className="mt-4 text-sm text-[#A0A3A8]">
              Once you're back online, this app will automatically sync your data.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}