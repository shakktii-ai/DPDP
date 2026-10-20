import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Organization from '@/models/Organization';
import Assessment from '@/models/Assessment';
import Finding from '@/models/Finding';
import Report from '@/models/Report';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();

    // Query real counts from MongoDB collections
    const [
      organizationsCount,
      assessmentsCompleted,
      assessmentsInProgress,
      openFindings,
      reportsGenerated,
      websitesAgg
    ] = await Promise.all([
      Organization.countDocuments(),
      Assessment.countDocuments({ status: 'completed' }),
      Assessment.countDocuments({ status: 'in_progress' }),
      Finding.countDocuments({ status: 'open' }),
      Report.countDocuments(),
      Organization.aggregate([
        { $unwind: { path: '$registeredWebsites', preserveNullAndEmptyArrays: false } },
        { $count: 'totalWebsites' }
      ])
    ]);

    const websitesCount = websitesAgg.length > 0 ? websitesAgg[0].totalWebsites : 0;

    const isEmptyInstallation =
      organizationsCount === 0 &&
      websitesCount === 0 &&
      assessmentsCompleted === 0 &&
      assessmentsInProgress === 0 &&
      openFindings === 0 &&
      reportsGenerated === 0;

    // Fetch recent items for dashboard activity if they exist
    const recentAssessments = await Assessment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('organization', 'name')
      .lean();

    const recentOrganizations = await Organization.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          organizations: organizationsCount,
          websites: websitesCount,
          assessmentsCompleted,
          assessmentsInProgress,
          openFindings,
          reportsGenerated
        },
        isEmpty: isEmptyInstallation,
        recentAssessments,
        recentOrganizations
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
