export const MAX_PHOTO_COUNT = 8;
export const MAX_PHOTO_BYTES = 1_250_000;
export const MAX_TOTAL_PHOTO_BYTES = 8_000_000;
export const MAX_SPECIFICATION_LENGTH = 8_000;
export const MAX_BRAND_NAME_LENGTH = 80;
export const MAX_BRAND_DESCRIPTION_LENGTH = 1_000;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type UploadCandidate = {
  name?: string;
  size: number;
  type: string;
};

export type AnalysisInput = {
  brandName: string;
  brandDescription: string;
  specifications: string;
  files: UploadCandidate[];
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateAnalysisInput(input: AnalysisInput): ValidationResult {
  if (!input.brandName.trim()) return { ok: false, message: "Add a shop name before analyzing." };
  if (input.brandName.trim().length > MAX_BRAND_NAME_LENGTH) return { ok: false, message: "Shop name must be 80 characters or fewer." };
  if (input.brandDescription.trim().length > MAX_BRAND_DESCRIPTION_LENGTH) return { ok: false, message: "Brand description must be 1,000 characters or fewer." };
  if (!input.specifications.trim()) return { ok: false, message: "Supplier specifications are required." };
  if (input.specifications.trim().length > MAX_SPECIFICATION_LENGTH) return { ok: false, message: "Supplier specifications must be 8,000 characters or fewer." };
  if (!input.files.length) return { ok: false, message: "Upload at least one vendor product photo for live analysis." };
  if (input.files.length > MAX_PHOTO_COUNT) return { ok: false, message: "Upload no more than eight vendor photos." };

  const totalBytes = input.files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_PHOTO_BYTES) return { ok: false, message: "Keep all vendor photos under 8 MB in total." };

  for (const file of input.files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return { ok: false, message: "Vendor photos must be JPG, PNG, or WebP files." };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return { ok: false, message: "Each vendor photo must be 1.25 MB or smaller." };
    }
  }

  return { ok: true };
}
