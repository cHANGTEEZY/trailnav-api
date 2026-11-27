import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import type {
  PresignedUploadPurpose,
  PresignedUploadRequest,
  PresignedUploadResponse,
} from "../../contracts";

const ALLOWED_MIME_TYPES: Record<PresignedUploadPurpose, readonly string[]> = {
  waypoint_photo: ["image/jpeg", "image/png", "image/webp"],
  hazard_photo: ["image/jpeg", "image/png", "image/webp"],
  track_gpx: ["application/gpx+xml", "application/xml", "text/xml"],
};

const MAX_UPLOAD_BYTES: Record<PresignedUploadPurpose, number> = {
  waypoint_photo: 10 * 1024 * 1024, // 10 MB
  hazard_photo: 10 * 1024 * 1024, // 10 MB
  track_gpx: 15 * 1024 * 1024, // 15 MB
};

export class R2NotConfiguredError extends Error {
  constructor() {
    super(
      "Cloudflare R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL.",
    );
    this.name = "R2NotConfiguredError";
  }
}

export class UploadPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadPolicyError";
  }
}

export function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 80) || "upload.bin";
}

export function validateUploadPolicy(input: PresignedUploadRequest): void {
  const allowed = ALLOWED_MIME_TYPES[input.purpose];
  if (!allowed.includes(input.contentType)) {
    throw new UploadPolicyError(
      `Unsupported contentType "${input.contentType}" for ${input.purpose}. Allowed: ${allowed.join(", ")}`,
    );
  }

  const maxBytes = MAX_UPLOAD_BYTES[input.purpose];
  if (input.sizeBytes > maxBytes) {
    throw new UploadPolicyError(
      `File size ${input.sizeBytes} exceeds maximum of ${maxBytes} bytes for ${input.purpose}`,
    );
  }
}

export function buildObjectKey(
  userId: string,
  input: Pick<PresignedUploadRequest, "purpose" | "entityId" | "fileName">,
): string {
  const safeEntity = input.entityId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const safeName = sanitizeFileName(input.fileName);
  const uniquePrefix = crypto.randomUUID().slice(0, 8);
  return `uploads/${input.purpose}/${userId}/${safeEntity}/${uniquePrefix}-${safeName}`;
}

export interface PresignedUrlSigner {
  presignPut(params: {
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    expiresInSeconds: number;
  }): Promise<{ uploadUrl: string; publicUrl: string }>;
}

export function createR2SignerFromEnv(): PresignedUrlSigner {
  let cachedClient: S3Client | null = null;

  return {
    async presignPut({ objectKey, contentType, sizeBytes, expiresInSeconds }) {
      const accountId = env.R2_ACCOUNT_ID;
      const accessKeyId = env.R2_ACCESS_KEY_ID;
      const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
      const bucketName = env.R2_BUCKET_NAME;
      const publicBaseUrl = env.R2_PUBLIC_BASE_URL;

      if (
        !accountId ||
        !accessKeyId ||
        !secretAccessKey ||
        !bucketName ||
        !publicBaseUrl
      ) {
        throw new R2NotConfiguredError();
      }

      if (!cachedClient) {
        cachedClient = new S3Client({
          region: "auto",
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
      }

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: contentType,
        ContentLength: sizeBytes,
      });

      const uploadUrl = await getSignedUrl(cachedClient, command, {
        expiresIn: expiresInSeconds,
      });

      const normalizedBase = publicBaseUrl.replace(/\/$/, "");
      return {
        uploadUrl,
        publicUrl: `${normalizedBase}/${objectKey}`,
      };
    },
  };
}

export async function createPresignedUpload(
  signer: PresignedUrlSigner,
  userId: string,
  input: PresignedUploadRequest,
  expiresInSeconds = env.R2_PRESIGN_EXPIRY_SECONDS,
): Promise<PresignedUploadResponse> {
  validateUploadPolicy(input);
  const objectKey = buildObjectKey(userId, input);
  const { uploadUrl, publicUrl } = await signer.presignPut({
    objectKey,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    expiresInSeconds,
  });

  const expiresAt = new Date(
    Date.now() + expiresInSeconds * 1000,
  ).toISOString();

  return {
    uploadUrl,
    publicUrl,
    objectKey,
    expiresAt,
    requiredHeaders: {
      "Content-Type": input.contentType,
    },
  };
}
