import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

/**
 * Configure Cloudinary with environment variables
 */
function getCloudinary() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (cloud_name && api_key && api_secret) {
    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
      secure: true,
    });
    return cloudinary;
  }

  return null;
}

/**
 * Returns true if Cloudinary credentials are fully configured.
 */
export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Uploads a local file or buffer to Cloudinary into a structured evidence folder.
 * 
 * @param {object} params
 * @param {string} [params.filePath] - Absolute path to local image on disk
 * @param {Buffer} [params.buffer] - Image buffer if uploading from memory
 * @param {string} params.runId - Assessment / TestRun ID for organizational folder
 * @param {string} params.filename - Base filename of the screenshot
 * @param {Array<string>} [params.tags] - Optional tags for indexing
 * @returns {Promise<{ success: boolean, url?: string, publicId?: string, bytes?: number, error?: string }>}
 */
export async function uploadEvidenceScreenshot({
  filePath,
  buffer,
  runId,
  filename,
  tags = [],
}) {
  const cld = getCloudinary();
  if (!cld) {
    return {
      success: false,
      error: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
    };
  }

  try {
    const cleanPublicId = filename.replace(/\.[^/.]+$/, '');
    const folder = `dpdp-vault/evidence/${runId}`;

    const uploadOptions = {
      folder,
      public_id: cleanPublicId,
      resource_type: 'image',
      overwrite: true,
      tags: ['dpdp-vault', 'evidence', `run_${runId}`, ...tags],
    };

    let result;
    if (filePath && fs.existsSync(filePath)) {
      result = await cld.uploader.upload(filePath, uploadOptions);
    } else if (buffer && Buffer.isBuffer(buffer)) {
      result = await new Promise((resolve, reject) => {
        const stream = cld.uploader.upload_stream(uploadOptions, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
        stream.end(buffer);
      });
    } else {
      throw new Error('Neither valid filePath nor buffer provided for Cloudinary upload.');
    }

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
      format: result.format,
    };
  } catch (err) {
    console.warn(`[Cloudinary Warning] Upload failed for ${filename} (Run: ${runId}):`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * High-level helper: Captures a Playwright page screenshot, writes a local copy to disk,
 * and uploads to Cloudinary. Falls back cleanly to local URL if Cloudinary is unavailable.
 * 
 * @param {object} params
 * @param {import('playwright').Page} params.page - Active Playwright page
 * @param {string} params.runId - TestRun ID
 * @param {string} params.filename - Desired filename
 * @param {string} params.evidenceDir - Local disk directory for evidence
 * @param {string} [params.scenarioId] - Scenario ID for tagging
 * @param {string} [params.stepName] - Step name for tagging
 * @returns {Promise<{
 *   screenshotUrl: string,
 *   localFilePath: string,
 *   localUrlPath: string,
 *   cloudinaryUrl: string | null,
 *   isCloudinary: boolean,
 *   fileSize: number
 * }>}
 */
export async function captureAndStoreScreenshot({
  page,
  runId,
  filename,
  evidenceDir,
  scenarioId = '',
  stepName = '',
}) {
  const localFilePath = path.join(evidenceDir, filename);
  const localUrlPath = `/evidence/${runId}/${filename}`;

  // 1. Take local Playwright screenshot
  await page.screenshot({ path: localFilePath, fullPage: false });

  if (!fs.existsSync(localFilePath) || fs.statSync(localFilePath).size === 0) {
    throw new Error(`Screenshot file write failed or empty at ${localFilePath}`);
  }

  const stat = fs.statSync(localFilePath);
  const fileSize = stat.size;

  let screenshotUrl = localUrlPath;
  let cloudinaryUrl = null;
  let isCloudinary = false;

  // 2. Upload to Cloudinary if configured
  if (isCloudinaryConfigured()) {
    try {
      const uploadRes = await uploadEvidenceScreenshot({
        filePath: localFilePath,
        runId,
        filename,
        tags: [scenarioId, stepName].filter(Boolean),
      });

      if (uploadRes.success && uploadRes.url) {
        screenshotUrl = uploadRes.url;
        cloudinaryUrl = uploadRes.url;
        isCloudinary = true;
        console.log(`[Cloudinary Upload] Stored screenshot for ${scenarioId || 'step'} on Cloudinary: ${uploadRes.url} (${uploadRes.bytes} bytes)`);
      } else {
        console.warn(`[Cloudinary Fallback] Using local URL for ${filename} due to upload error: ${uploadRes.error}`);
      }
    } catch (cldErr) {
      console.warn(`[Cloudinary Fallback] Exception during upload, using local URL:`, cldErr.message);
    }
  } else {
    console.log(`[Screenshot Local] Cloudinary not configured; stored locally at: ${localUrlPath} (${fileSize} bytes)`);
  }

  return {
    screenshotUrl,
    localFilePath,
    localUrlPath,
    cloudinaryUrl,
    isCloudinary,
    fileSize,
  };
}
