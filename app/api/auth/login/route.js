import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';
import { comparePassword, generateSessionToken, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Query user including password field (which is select: false by default)
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password credentials.' },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      // Audit log failed login
      await AuditLog.create({
        action: 'USER_LOGIN_FAILED',
        category: 'auth',
        actor: { email: normalizedEmail },
        target: { entityType: 'User', identifier: normalizedEmail },
        details: { reason: 'Password mismatch' },
        status: 'failure'
      });

      return NextResponse.json(
        { success: false, error: 'Invalid email or password credentials.' },
        { status: 401 }
      );
    }

    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();

    const token = generateSessionToken(user);

    // Audit log successful login
    await AuditLog.create({
      action: 'USER_LOGGED_IN',
      category: 'auth',
      actor: {
        userId: user._id,
        email: user.email
      },
      target: {
        entityType: 'User',
        entityId: user._id,
        identifier: user.email
      },
      details: { role: user.role },
      status: 'success'
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization
      }
    });

    // Set secure HTTP-only cookie
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
