import bcrypt from 'bcrypt';

// Hash a password
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
};

// Verify a password against a hash
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const isValid = await bcrypt.compare(password, hash);
  return isValid;
};