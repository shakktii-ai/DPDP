import { NextResponse } from 'next/server';
import { verifyGeminiCapabilities } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const candidateModel = searchParams.get('model') || undefined;

    const capabilities = await verifyGeminiCapabilities(candidateModel);
    return NextResponse.json({ success: true, capabilities });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        capabilities: {
          isConfigured: false,
          activeModel: null,
          proposedModel: 'gemini-3.8-flash',
          isProposedAvailable: false,
          computerUseSupported: false,
          status: 'error',
          message: error.message
        }
      },
      { status: 500 }
    );
  }
}
