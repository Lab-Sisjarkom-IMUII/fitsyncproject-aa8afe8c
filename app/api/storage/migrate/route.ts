import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import ServerUnifiedStore from '@/lib/storage/server-unified-store';

// Simple rate limiting mechanism
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100; // Max 100 requests per window

  const record = rateLimitMap.get(identifier);

  if (!record) {
    // First request from this identifier
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (now > record.resetTime) {
    // Reset window
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  // Increment count
  rateLimitMap.set(identifier, { ...record, count: record.count + 1 });
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Get session to validate user
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized: User session required' },
        { status: 401 }
      );
    }

    // Get userId from session
    const userId = session.user.email || session.user.id || session.user.name;
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid user session' },
        { status: 400 }
      );
    }

    // Parse request body
    const { records = [] } = await request.json();

    if (!Array.isArray(records)) {
      return NextResponse.json(
        { error: 'Invalid records format: expected array' },
        { status: 400 }
      );
    }

    // Perform migration
    const migrationResult = await ServerUnifiedStore.migrateFromClient(userId, records);

    return NextResponse.json({
      success: true,
      ...migrationResult
    });
  } catch (error) {
    console.error('Error in migration API:', error);
    return NextResponse.json(
      { error: 'Internal server error during migration' },
      { status: 500 }
    );
  }
}