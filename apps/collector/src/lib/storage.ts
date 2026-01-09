import {
  extractFileExtension,
  FileSizeLimits,
  getProductImagePath,
  getStoragePublicUrl,
  isAllowedMimeType,
  StorageBuckets,
} from "@framerate/db";
import sharp from "sharp";
import { Logger } from "./logger";
import { supabase } from "./supabase";

const logger = new Logger("Storage");

const uploadedMpnCache = new Set<string>();
const SUPABASE_URL = Bun.env.SUPABASE_URL || "";

export interface ImageUploadResult {
  success: boolean;
  url: string | null;
  error?: string;
  cached?: boolean;
}

export async function checkProductImageExists(mpn: string): Promise<string | null> {
  // Only check for AVIF, effectively ignoring legacy formats to force upgrade/re-upload as AVIF
  const extensions = ["avif"] as const;

  for (const ext of extensions) {
    const filePath = getProductImagePath(mpn, ext);

    const { data } = await supabase.storage.from(StorageBuckets.PRODUCT_IMAGES).list("", {
      search: filePath,
    });

    if (data && data.length > 0) {
      const exactMatch = data.find((f) => f.name === filePath);
      if (exactMatch) {
        return getStoragePublicUrl(SUPABASE_URL, StorageBuckets.PRODUCT_IMAGES, filePath);
      }
    }
  }

  return null;
}

async function downloadImage(imageUrl: string): Promise<{
  data: ArrayBuffer;
  mimeType: string;
  extension: string;
} | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "image/webp,image/png,image/jpeg,image/*",
      },
    });

    if (!response.ok) {
      logger.warn(`Failed to download image: ${response.status} - ${imageUrl}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const mimeType = contentType.split(";")[0].trim();

    let extension = "webp";
    if (mimeType === "image/png") {
      extension = "png";
    } else if (mimeType === "image/jpeg") {
      extension = "jpeg";
    } else if (mimeType === "image/webp") {
      extension = "webp";
    } else {
      const urlExtension = extractFileExtension(imageUrl);
      if (urlExtension && ["png", "jpeg", "jpg", "webp"].includes(urlExtension)) {
        extension = urlExtension === "jpg" ? "jpeg" : urlExtension;
      }
    }

    const data = await response.arrayBuffer();

    return { data, mimeType, extension };
  } catch (error) {
    logger.error(`Error downloading image from ${imageUrl}:`, String(error));
    return null;
  }
}

export async function uploadProductImage(
  mpn: string,
  externalImageUrl: string | undefined,
): Promise<ImageUploadResult> {
  if (!externalImageUrl) {
    return { success: false, url: null, error: "No image URL provided" };
  }

  if (!mpn) {
    return { success: false, url: null, error: "No MPN provided" };
  }

  const sanitizedMpn = mpn
    .trim()
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  if (uploadedMpnCache.has(sanitizedMpn)) {
    logger.info(`Image for MPN ${mpn} already uploaded this session (cached)`);
    const existingUrl = await checkProductImageExists(sanitizedMpn);
    if (existingUrl) {
      return { success: true, url: existingUrl, cached: true };
    }
  }

  const existingUrl = await checkProductImageExists(sanitizedMpn);
  if (existingUrl) {
    logger.info(`Image for MPN ${mpn} already exists in storage`);
    uploadedMpnCache.add(sanitizedMpn);
    return { success: true, url: existingUrl, cached: true };
  }

  const imageData = await downloadImage(externalImageUrl);
  if (!imageData) {
    return {
      success: false,
      url: null,
      error: `Failed to download image from ${externalImageUrl}`,
    };
  }

  if (!isAllowedMimeType(StorageBuckets.PRODUCT_IMAGES, imageData.mimeType)) {
    return {
      success: false,
      url: null,
      error: `Invalid mime type: ${imageData.mimeType}`,
    };
  }

  const maxSize = FileSizeLimits[StorageBuckets.PRODUCT_IMAGES];
  // Always convert to AVIF
  let finalData: ArrayBuffer | Buffer = imageData.data;
  const finalMimeType = "image/avif";
  const _finalExtension = "avif";

  try {
    let compressed = await sharp(Buffer.from(imageData.data)).avif({ quality: 80 }).toBuffer();

    if (compressed.byteLength > maxSize) {
      logger.info(`AVIF image for MPN ${mpn} exceeds ${maxSize} bytes (${compressed.byteLength}), resizing...`);

      const resized = await sharp(Buffer.from(imageData.data))
        .resize({ width: 1200, withoutEnlargement: true })
        .avif({ quality: 70 })
        .toBuffer();

      if (resized.byteLength > maxSize) {
        const aggressive = await sharp(Buffer.from(imageData.data))
          .resize({ width: 800, withoutEnlargement: true })
          .avif({ quality: 60 })
          .toBuffer();
        compressed = aggressive;
      } else {
        compressed = resized;
      }
    }

    finalData = compressed;
    logger.info(
      `Converted/Compressed image for MPN ${mpn} to AVIF: ${imageData.data.byteLength} -> ${finalData.byteLength} bytes`,
    );
  } catch (compressError) {
    logger.error(`Failed to convert image to AVIF for MPN ${mpn}:`, String(compressError));
    return {
      success: false,
      url: null,
      error: `Failed to convert image: ${String(compressError)}`,
    };
  }

  const filePath = getProductImagePath(sanitizedMpn, "avif");

  const { error: uploadError } = await supabase.storage
    .from(StorageBuckets.PRODUCT_IMAGES)
    .upload(filePath, finalData, {
      contentType: finalMimeType,
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message?.includes("already exists") || uploadError.message?.includes("Duplicate")) {
      logger.info(`Image for MPN ${mpn} was uploaded by another process`);
      const existingUrl = getStoragePublicUrl(SUPABASE_URL, StorageBuckets.PRODUCT_IMAGES, filePath);
      uploadedMpnCache.add(sanitizedMpn);
      return { success: true, url: existingUrl, cached: true };
    }

    logger.error(`Failed to upload image for MPN ${mpn}:`, uploadError.message);
    return {
      success: false,
      url: null,
      error: uploadError.message,
    };
  }

  const publicUrl = getStoragePublicUrl(SUPABASE_URL, StorageBuckets.PRODUCT_IMAGES, filePath);

  uploadedMpnCache.add(sanitizedMpn);

  logger.info(`Uploaded image for MPN ${mpn}: ${filePath}`);

  return { success: true, url: publicUrl };
}

export function clearImageCache(): void {
  uploadedMpnCache.clear();
}
