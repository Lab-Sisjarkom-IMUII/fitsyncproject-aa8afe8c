'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FcGoogle } from 'react-icons/fc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getUserProfile } from '@/lib/userProfile'
import { setSession, clearSession, getSession } from '@/lib/session'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLogin, setIsLogin] = useState(true) // Toggle between login and register
  const { data: session, status } = useSession();
  const router = useRouter()

  // Check if already logged in on mount, but only redirect if we have a valid session
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      // Check both next-auth status and our local session
      const isAuthenticated = (status === 'authenticated') || (getSession() !== null && getSession() !== undefined && getSession()?.username);
      
      // Only redirect if we're truly authenticated and it's not just loading
      if (status !== 'loading' && isAuthenticated) {
        // Check if user has completed onboarding
        const profile = getUserProfile();
        console.log('Login page - checking profile:', profile);
        
        if (!profile?.onboardingCompleted) {
          console.log('Login page - redirecting to onboarding');
          router.push('/onboarding');
        } else {
          console.log('Login page - redirecting to dashboard');
          router.push('/dashboard');
        }
      }
    }
  }, [status]); // Tambahkan status sebagai dependency untuk memastikan redirect hanya terjadi jika status sudah jelas

  // Initialize default values in localStorage for a new user
  const initializeUserData = () => {
    // Initialize default activity tracking values if they don't exist
    if (!localStorage.getItem('steps')) localStorage.setItem('steps', '0');
    if (!localStorage.getItem('calories')) localStorage.setItem('calories', '0');
    if (!localStorage.getItem('sleepHours')) localStorage.setItem('sleepHours', '0');
    if (!localStorage.getItem('goalSteps')) localStorage.setItem('goalSteps', '10000');
    
    // Initialize default weekly data for the past 7 days
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const formattedDate = date.toISOString().split('T')[0];
      
      const stepsKey = `steps-${formattedDate}`;
      const caloriesKey = `calories-${formattedDate}`;
      const sleepKey = `sleep-${formattedDate}`;
      
      if (!localStorage.getItem(stepsKey)) localStorage.setItem(stepsKey, '0');
      if (!localStorage.getItem(caloriesKey)) localStorage.setItem(caloriesKey, '0');
      if (!localStorage.getItem(sleepKey)) localStorage.setItem(sleepKey, '0');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      // First check if we're on the client side
      if (typeof window === 'undefined') {
        setError('Client-side only operation');
        return;
      }

      // First check if user exists in localStorage (for our simple auth system)
      const usersJson = localStorage.getItem('users');
      const users = usersJson ? JSON.parse(usersJson) : [];
      
      const userExists = users.find(u => u.username === username);
      
      if (!userExists) {
        setError('User not found');
        return;
      }
      
      if (userExists.password !== password) {
        setError('Password incorrect');
        return;
      }

      // Set session for the logged-in user
      const sessionData = {
        username,
        email: userExists.email || '',
        name: userExists.name || username
      };
      
      setSession(sessionData);
      console.log('Session set for user:', sessionData);

      // Check if user has completed onboarding
      const profile = getUserProfile();
      console.log('User profile after login:', profile);
      
      // Wait briefly to ensure session is saved before redirect
      await new Promise(resolve => setTimeout(resolve, 100));

      // Migrate local data to server after successful login
      if (typeof window !== 'undefined') {
        try {
          const migrateLocalToServer = (await import('@/lib/storage/storage-sync')).default;
          await migrateLocalToServer(username);
          console.log('Local data migration initiated after login');
        } catch (migrationError) {
          console.error('Error during data migration:', migrationError);
          // Continue with normal flow even if migration fails
        }
      }

      if (!profile?.onboardingCompleted) {
        console.log('Redirecting to onboarding after login');
        router.push('/onboarding');
      } else {
        console.log('Redirecting to dashboard after login');
        // Only initialize user data if it doesn't exist yet
        if (!localStorage.getItem('steps') || !localStorage.getItem('calories') || !localStorage.getItem('sleepHours')) {
          initializeUserData();
        }
        router.push('/dashboard');
      }
    } catch (error) {
      console.log(error)
      setError('An error occurred during login')
    }
  }

  const handleGoogleLogin = async () => {
    try {
      // Clear any existing local session before Google login
      clearSession();
      // For Google login, we'll check if user has profile first
      const callbackUrl = '/auth/callback'; // Will handle redirection in callback
      await signIn('google', { callbackUrl });
    } catch (error) {
      console.error('Google login error:', error);
      setError('An error occurred during Google login. Please try again.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E0E12] p-4">
      <div className="w-full max-w-md bg-[#1C1F26] rounded-2xl shadow-xl overflow-hidden border border-[#2A2D33]">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white">FitSync</h1>
            <p className="text-[#A0A3A8] mt-2">Your Wellness, Synced</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 text-red-300 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="mb-6 flex border-b border-[#2A2D33]">
            <button
              className={`pb-3 px-4 font-medium text-sm ${isLogin ? 'text-[#00FFAA] border-b-2 border-[#00FFAA]' : 'text-[#A0A3A8]'}`}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button
              className={`pb-3 px-4 font-medium text-sm ${!isLogin ? 'text-[#00FFAA] border-b-2 border-[#00FFAA]' : 'text-[#A0A3A8]'}`}
              onClick={() => setIsLogin(false)}
            >
              Register
            </button>
          </div>

          {isLogin ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="username" className="text-[#E4E6EB]">Username or Email</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 bg-[#22252D] border-[#2A2D33] text-white rounded-lg"
                    required
                    placeholder="Enter your username or email"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-[#E4E6EB]">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 bg-[#22252D] border-[#2A2D33] text-white rounded-lg"
                    required
                    placeholder="Enter your password"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-[#7C3AED] to-[#00FFAA] hover:from-[#6d32d6] hover:to-[#00e69a] text-white py-2 rounded-lg transition"
                >
                  Sign In
                </Button>
              </form>

              <div className="mt-6">
                <Button
                  onClick={handleGoogleLogin}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 border border-[#2A2D33] py-2 rounded-lg hover:bg-[#22252D] transition text-white"
                >
                  <FcGoogle className="text-xl" />
                  <span>Continue with Google</span>
                </Button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-[#A0A3A8] text-sm">
                  Don't have an account?{' '}
                  <button 
                    className="text-[#00FFAA] font-medium hover:underline"
                    onClick={() => setIsLogin(false)}
                  >
                    Register
                  </button>
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-[#A0A3A8] mb-6">To register, please use the registration form</p>
              <Link href="/auth/register">
                <Button className="bg-gradient-to-r from-[#7C3AED] to-[#00FFAA] hover:from-[#6d32d6] hover:to-[#00e69a] text-white py-2 rounded-lg transition">
                  Go to Registration
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}