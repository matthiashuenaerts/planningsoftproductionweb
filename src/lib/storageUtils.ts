import { supabase } from '@/integrations/supabase/client';

/**
 * Extracts the storage path from a legacy public URL or returns the path as-is.
 */
export function extractStoragePath(bucket: string, pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  
  // If it's already a path (not a URL), return it
  if (!pathOrUrl.startsWith('http')) {
    return pathOrUrl;
  }
  
  try {
    const url = new URL(pathOrUrl);
    // Try to extract path after /object/public/<bucket>/
    const parts = url.pathname.split(`/object/public/${bucket}/`);
    if (parts.length > 1) {
      return decodeURIComponent(parts[1]);
    }
    // Try alternate pattern: /storage/v1/object/public/<bucket>/
    const altParts = url.pathname.split(`/${bucket}/`);
    if (altParts.length > 1) {
      return decodeURIComponent(altParts[altParts.length - 1]);
    }
  } catch {
    // If URL parsing fails, return as-is
  }
  
  return pathOrUrl;
}

/**
 * Creates a signed URL for a storage path (for use in non-React contexts like services).
 * Returns null if the path is invalid.
 */
export async function createSignedUrl(
  bucket: string,
  pathOrUrl: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  const storagePath = extractStoragePath(bucket, pathOrUrl);
  if (!storagePath) return null;
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresIn);
  
  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
  
  return data.signedUrl;
}

/**
 * Creates multiple signed URLs in batch.
 */
export async function createSignedUrls(
  bucket: string,
  pathsOrUrls: (string | null | undefined)[],
  expiresIn = 3600
): Promise<(string | null)[]> {
  const paths = pathsOrUrls
    .map(p => extractStoragePath(bucket, p))
    .filter((p): p is string => p !== null);
  
  if (paths.length === 0) {
    return pathsOrUrls.map(() => null);
  }
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);
  
  if (error) {
    console.error('Error creating signed URLs:', error);
    return pathsOrUrls.map(() => null);
  }
  
  // Map back to original indices
  const signedUrlMap = new Map(data.map((item) => [item.path, item.signedUrl]));
  
  return pathsOrUrls.map(pathOrUrl => {
    const storagePath = extractStoragePath(bucket, pathOrUrl);
    if (!storagePath) return null;
    return signedUrlMap.get(storagePath) || null;
  });
}
