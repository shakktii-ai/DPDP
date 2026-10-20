import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Evidence from '@/models/Evidence';

export const dynamic = 'force-dynamic';

/**
 * GET /evidence/[runId]/[filename]
 * Dynamically serves evidence screenshots captured by Playwright.
 * Serves from local disk if available, or redirects to Cloudinary if hosted in cloud.
 */
export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const { runId, filename } = resolvedParams;

    if (!runId || !filename) {
      return new Response(JSON.stringify({ error: 'Missing runId or filename' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Sanitize parameters to prevent path traversal attacks
    const safeRunId = path.basename(runId);
    const safeFilename = path.basename(filename);

    // Primary location: public/evidence/[runId]/[filename]
    const filePath = path.join(process.cwd(), 'public', 'evidence', safeRunId, safeFilename);

    if (!fs.existsSync(filePath)) {
      // Check if evidence exists in database with Cloudinary URL
      try {
        await connectDB();
        const baseName = safeFilename.replace(/\.[^/.]+$/, '');
        const query = {
          screenshotPath: { $regex: baseName, $options: 'i' },
        };
        if (mongoose.isValidObjectId(safeRunId)) {
          query.testRunId = safeRunId;
        }

        const ev = await Evidence.findOne(query).lean();
        if (ev && ev.screenshotPath && ev.screenshotPath.startsWith('http')) {
          return Response.redirect(ev.screenshotPath, 302);
        }
      } catch (dbErr) {
        console.warn('Fallback Cloudinary redirect check error:', dbErr.message);
      }

      return new Response(JSON.stringify({ error: 'Evidence screenshot not found on disk or Cloudinary' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return new Response(JSON.stringify({ error: 'Evidence screenshot file is empty' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(safeFilename).toLowerCase();
    const contentType =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
        ? 'image/webp'
        : ext === '.svg'
        ? 'image/svg+xml'
        : 'image/png';

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    console.error('[Evidence Route Error]:', err.message);
    return new Response(JSON.stringify({ error: 'Failed to retrieve evidence screenshot' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
