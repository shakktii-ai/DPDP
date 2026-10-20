import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

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

    const safeRunId = path.basename(runId);
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'public', 'evidence', safeRunId, safeFilename);

    if (!fs.existsSync(filePath)) {
      return new Response(JSON.stringify({ error: 'Evidence file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stat = fs.statSync(filePath);
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
