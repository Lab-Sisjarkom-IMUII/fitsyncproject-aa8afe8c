// lib/users.ts
// Updated user management with Prisma database integration

import prisma from '@/lib/prisma';
import { hashPassword, verifyPassword } from './auth';

interface User {
  id: string;
  username: string;
  email: string;
  password: string; // In production, this should be hashed
  phone: string;
  xp: number;
  level: number;
  createdAt: Date;
}

// Function to create a new user
const createUser = async (userData: Omit<User, 'id' | 'xp' | 'level' | 'createdAt'>): Promise<User> => {
  // Check if username or email already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username: userData.username },
        { email: userData.email }
      ]
    }
  });
  
  if (existingUser) {
    throw new Error('Username or email already exists');
  }

  // Hash the password before storing (only if password is provided)
  let hashedPassword = userData.password;
  if (userData.password) {
    hashedPassword = await hashPassword(userData.password);
  }

  // Create new user with Prisma
  const newUser = await prisma.user.create({
    data: {
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      phone: userData.phone,
      xp: 0, // New users start with 0 XP
      level: 1, // New users start at level 1
    }
  });

  return {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    password: newUser.password, // This will be the hashed password
    phone: newUser.phone,
    xp: newUser.xp,
    level: newUser.level,
    createdAt: newUser.createdAt
  };
};

// Function to create a Google user (without password)
const createGoogleUser = async (userData: Omit<User, 'id' | 'xp' | 'level' | 'createdAt' | 'password'>): Promise<User> => {
  // Check if email already exists
  const existingUser = await prisma.user.findFirst({
    where: { email: userData.email }
  });
  
  if (existingUser) {
    throw new Error('Email already exists');
  }

  // Create new user with Prisma (no password for Google users)
  const newUser = await prisma.user.create({
    data: {
      username: userData.username,
      email: userData.email,
      password: '', // No password for Google users
      phone: userData.phone,
      xp: 0, // New users start with 0 XP
      level: 1, // New users start at level 1
    }
  });

  return {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    password: newUser.password,
    phone: newUser.phone,
    xp: newUser.xp,
    level: newUser.level,
    createdAt: newUser.createdAt
  };
};

// Function to find user by username or email
const findUser = async (usernameOrEmail: string): Promise<User | null> => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: usernameOrEmail },
        { email: usernameOrEmail }
      ]
    }
  });
  
  if (!user) {
    return null;
  }
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    password: user.password,
    phone: user.phone,
    xp: user.xp,
    level: user.level,
    createdAt: user.createdAt
  };
};

// Function to find user by email only
const findUserByEmail = async (email: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (!user) {
    return null;
  }
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    password: user.password,
    phone: user.phone,
    xp: user.xp,
    level: user.level,
    createdAt: user.createdAt
  };
};

// Function to find user by ID
const findUserById = async (id: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({
    where: { id }
  });
  
  if (!user) {
    return null;
  }
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    password: user.password,
    phone: user.phone,
    xp: user.xp,
    level: user.level,
    createdAt: user.createdAt
  };
};

// Function to update user XP
const updateUserXp = async (id: string, xp: number): Promise<User | null> => {
  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        xp: {
          increment: xp
        }
      }
    });
    
    // Calculate new level based on XP
    const newLevel = Math.floor(Math.sqrt(user.xp / 100)) + 1;
    
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        level: newLevel
      }
    });
    
    return {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      password: updatedUser.password,
      phone: updatedUser.phone,
      xp: updatedUser.xp,
      level: updatedUser.level,
      createdAt: updatedUser.createdAt
    };
  } catch (error) {
    console.error('Error updating user XP:', error);
    return null;
  }
};

// Function to validate user credentials
const validateUser = async (usernameOrEmail: string, password: string): Promise<User | null> => {
  const user = await findUser(usernameOrEmail);
  
  // For Google users, they might not have a password set
  if (user && !user.password) {
    return user;
  }
  
  if (user && await verifyPassword(password, user.password)) {
    return user;
  }
  
  return null;
};

// Function to get all users (for testing/debugging purposes)
const getAllUsers = async (): Promise<User[]> => {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: 'asc'
    }
  });
  
  return users.map(user => ({
    id: user.id,
    username: user.username,
    email: user.email,
    password: user.password,
    phone: user.phone,
    xp: user.xp,
    level: user.level,
    createdAt: user.createdAt
  }));
};

export type { User };
export {
  createUser,
  createGoogleUser,
  findUser,
  findUserByEmail,
  findUserById,
  updateUserXp,
  validateUser,
  getAllUsers
};