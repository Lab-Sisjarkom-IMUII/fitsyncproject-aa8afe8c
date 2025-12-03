'use client';

import { useState, useEffect, useCallback } from 'react';

declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
      outcome: 'accepted' | 'dismissed';
      platform: string;
    }>;
    prompt(): Promise<void>;
  }
}

const InstallPWAButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Only run on client side to prevent SSR issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if app is already installed
  const checkAppInstallStatus = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;

    // Check if app is running in standalone mode
    // Note: navigator.standalone is iOS Safari specific
    const isStandalone = 'standalone' in window.navigator
      ? (window.navigator as any).standalone === true
      : false;

    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      isStandalone ||
      document.referrer.includes('android-app://') ||
      document.referrer.includes('com.web.app')
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isClient) return;

    // Ensure we're in a browser environment that supports PWA features
    if (!('serviceWorker' in navigator) || !('BeforeInstallPromptEvent' in window)) {
      console.log('[PWA] PWA features not supported in this browser');
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt event received');
      // Stash the event so it can be triggered later
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] App installed event fired');
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Check current install status on mount
    setIsInstalled(checkAppInstallStatus());

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    // Listen for the appinstalled event
    window.addEventListener('appinstalled', handleAppInstalled);

    // Additional check: if PWA is already installed, reset state
    const updateInstallStatus = () => {
      const installed = checkAppInstallStatus();
      if (installed) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    // Check when visibility changes (e.g. user returns from installing)
    document.addEventListener('visibilitychange', updateInstallStatus);

    // Initial check for installed status to handle cases where status might change
    // between page loads
    const initialCheckTimer = setTimeout(() => {
      const installed = checkAppInstallStatus();
      if (installed) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    }, 500); // Small delay to ensure all browser states are initialized

    return () => {
      // Clean up event listeners
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      document.removeEventListener('visibilitychange', updateInstallStatus);
      clearTimeout(initialCheckTimer);
    };
  }, [isClient, checkAppInstallStatus]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.warn('[PWA] No deferred prompt available');
      return;
    }

    console.log('[PWA] Install button clicked, showing install prompt');
    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);

      if (outcome === 'accepted') {
        // User accepted the install prompt
        setIsInstalled(true);
        setDeferredPrompt(null);
        console.log('[PWA] App installation accepted');
      } else {
        console.log('[PWA] App installation dismissed');
        // Keep the prompt available if user dismissed it
        // Reset the button if they dismissed it to avoid showing again
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error('[PWA] Error during install prompt:', error);
      // On error, clear the deferred prompt
      setDeferredPrompt(null);
    }
  };

  // Don't show the button if:
  // - Not running on client
  // - App is already installed
  // - No prompt is available
  if (!isClient || isInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-blue-800 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Install FitSync App
            </h3>
            <p className="text-sm text-blue-600 mt-1">
              Add to your home screen for quick access and better experience
            </p>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all font-medium whitespace-nowrap shadow-md hover:shadow-lg"
          >
            Install App
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPWAButton;