import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Organization from '@/models/Organization';
import { getAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = getAuthSession(request);

    if (!session) {
      return NextResponse.json({ success: true, user: null });
    }

    await connectToDatabase();
    const user = await User.findById(session.userId).lean();

    if (!user) {
      return NextResponse.json({ success: true, user: null });
    }

    let organization = null;
    if (user.organization) {
      organization = await Organization.findById(user.organization)
        .select('name legalEntityName industry websiteUrl dpdpRegistrationNumber')
        .lean();
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: organization || user.organization
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
