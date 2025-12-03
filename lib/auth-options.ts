import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { validateUser, findUserByEmail, createGoogleUser } from '@/lib/users'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // Validate credentials against the database
        if (credentials?.username && credentials?.password) {
          const user = await validateUser(credentials.username, credentials.password);

          if (user) {
            return {
              id: user.id,
              name: user.username,
              email: user.email
            };
          }
        }
        return null;
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
    })
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      // When signing in with Google, store Google profile info
      if (account && profile) {
        token.googleId = profile.sub; // Google's user ID
        token.name = profile.name;
        token.email = profile.email;
        token.image = (profile as any).picture || (profile as any).image; // Handle different profile formats
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.id;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.image as string;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // For Google sign-in, ensure user exists in database
      if (account.provider === 'google') {
        try {
          // Check if user exists by email
          const existingUser = await findUserByEmail(user.email);
          if (!existingUser) {
            // Create new Google user (without password)
            await createGoogleUser({
              username: user.email.split('@')[0], // Use part of email as username
              email: user.email,
              phone: '',
            });
          }
          return true; // Allow sign in
        } catch (error) {
          console.error('Error during Google sign in:', error);
          return false; // Deny sign in
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  },
  pages: {
    signIn: '/auth/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'secret'
}