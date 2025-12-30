'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { setSession } from '@/lib/session';
import { getUserProfile } from '@/lib/userProfile';

export default function AuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Set session for Google login
      setSession({
        username: session.user.email.split('@')[0], // Use email prefix as username
        email: session.user.email,
        name: session.user.name || session.user.email
      });

      // Migrate local data to server after successful Google login
      if (typeof window !== 'undefined') {
        try {
          const userId = session.user.email || session.user.name;
          const migrateLocalToServer = (await import('@/lib/storage/storage-sync')).default;
          await migrateLocalToServer(userId);
          console.log('Local data migration initiated after Google login');
        } catch (migrationError) {
          console.error('Error during data migration:', migrationError);
          // Continue with normal flow even if migration fails
        }
      }

      // Check if user has completed onboarding
      const profile = getUserProfile();
      if (!profile?.onboardingCompleted) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } else if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E0E12]">
      <div className="text-white text-xl">Redirecting...</div>
    </div>
  );
}