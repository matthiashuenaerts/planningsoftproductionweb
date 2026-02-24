import React from 'react';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface SignedStorageImageProps {
  bucket: string;
  path: string | null | undefined;
  alt: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Displays an image from a private Supabase storage bucket using a signed URL.
 */
const SignedStorageImage: React.FC<SignedStorageImageProps> = ({ bucket, path, alt, className, onClick }) => {
  const signedUrl = useSignedUrl(bucket, path);

  if (!signedUrl) return null;

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
      onClick={onClick}
    />
  );
};

export default SignedStorageImage;
