import type {
  PresignedUploadRequest,
  PresignedUploadResponse,
} from "../../contracts";
import {
  createPresignedUpload,
  createR2SignerFromEnv,
  type PresignedUrlSigner,
} from "../../shared/storage/r2";

export function createMediaService(
  signer: PresignedUrlSigner = createR2SignerFromEnv(),
) {
  return {
    async presignUpload(
      userId: string,
      input: PresignedUploadRequest,
    ): Promise<PresignedUploadResponse> {
      return createPresignedUpload(signer, userId, input);
    },
  };
}

export const mediaService = createMediaService();
