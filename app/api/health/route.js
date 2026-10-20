import { NextResponse } from 'next/server';
import { getDatabaseStatus } from '@/lib/mongodb';
import { verifyGeminiCapabilities } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * Reports application, database, and AI service health without exposing credentials.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  // Check database connectivity safely
  const dbStatus = await getDatabaseStatus();

  // Check AI service availability safely without throwing
  let geminiStatus;
  try {
    geminiStatus = await verifyGeminiCapabilities();
  } catch (err) {
    geminiStatus = {
      isConfigured: false,
      status: 'error',
      message: 'Failed to query AI provider health safely',
      activeModel: null,
      proposedModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash'
    };
  }

  const isHealthy = dbStatus.isConnected;
  const httpStatus = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      application: {
        name: 'DPDP Automated Website Assessment Platform',
        version: '1.0.0-phase1',
        environment: process.env.NODE_ENV || 'development',
        timestamp
      },
      services: {
        database: {
          connected: dbStatus.isConnected,
          state: dbStatus.stateName,
          databaseName: dbStatus.databaseName || null,
          ...(dbStatus.error && { notice: dbStatus.error })
        },
        aiEngine: {
          configured: geminiStatus.isConfigured,
          status: geminiStatus.status,
          activeModel: geminiStatus.activeModel,
          proposedModel: geminiStatus.proposedModel,
          computerUseSupported: geminiStatus.computerUseSupported || false,
          notice: geminiStatus.message
        }
      }
    },
    { status: httpStatus }
  );
}
