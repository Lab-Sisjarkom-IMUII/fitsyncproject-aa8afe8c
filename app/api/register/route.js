export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createUser, validateUser } from '@/lib/users';

export async function POST(request) {
  try {
    const { username, email, password, phone } = await request.json();

    if (!username || !email || !password || !phone) {
      return new Response(
        JSON.stringify({ message: 'All fields are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Additional validation can be added here
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ message: 'Password must be at least 6 characters long' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ message: 'Please enter a valid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Phone number validation
    if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
      return new Response(
        JSON.stringify({ message: 'Please enter a valid phone number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Attempt to create the user
    const newUser = await createUser({
      username,
      email,
      password, // Will be hashed in the service
      phone
    });

    return new Response(
      JSON.stringify({ 
        message: 'User created successfully',
        user: { id: newUser.id, username: newUser.username, email: newUser.email }
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error.message === 'Username or email already exists') {
      return new Response(
        JSON.stringify({ message: error.message }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ message: 'An error occurred during registration' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}