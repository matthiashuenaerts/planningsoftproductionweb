import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves a storage path or legacy public URL to a signed URL for private buckets.
 * Returns the signed URL or null while loading.
 */
export function useSignedUrl(
  bucket: string,
  pathOrUrl: string | null | undefined,
  expiresIn = 3600
): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pathOrUrl) {
      setSignedUrl(null);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      // Determine the storage path:
      // If it looks like a full URL (legacy data), extract the path after /object/public/<bucket>/
      let storagePath = pathOrUrl;
      if (pathOrUrl.startsWith('http')) {
        try {
          const url = new URL(pathOrUrl);
          const parts = url.pathname.split(`/object/public/${bucket}/`);
          if (parts.length > 1) {
            storagePath = parts[1];
          } else {
            // Try alternate pattern: /storage/v1/object/public/<bucket>/
            const altParts = url.pathname.split(`/${bucket}/`);
            if (altParts.length > 1) {
              storagePath = altParts[altParts.length - 1];
            }
          }
        } catch {
          // If URL parsing fails, use as-is
        }
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresIn);

      if (!cancelled) {
        if (error) {
          console.error('Error creating signed URL:', error);
          // Fallback: try using the original URL in case bucket is actually public
          setSignedUrl(pathOrUrl.startsWith('http') ? pathOrUrl : null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [bucket, pathOrUrl, expiresIn]);

  return signedUrl;
}
