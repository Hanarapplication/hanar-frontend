import { supabase } from '@/lib/supabaseClient';

const COMMUNITY_IMAGES_BUCKET = 'community-images';

/**
 * Upload a file to Supabase Storage with XMLHttpRequest so we can report upload progress.
 * Matches the multipart shape used by @supabase/storage-js (cacheControl + file field "").
 */
export function uploadToCommunityImagesBucket(
  pathWithinBucket: string,
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return Promise.reject(new Error('Missing Supabase environment variables'));
  }

  const cleanPath = pathWithinBucket.replace(/^\/|\/$/g, '').replace(/\/+/g, '/');
  const objectPath = `${COMMUNITY_IMAGES_BUCKET}/${cleanPath}`;
  const url = `${supabaseUrl}/storage/v1/object/${encodeURI(objectPath)}`;

  return supabase.auth.getSession().then(({ data: { session } }) => {
    const token = session?.access_token ?? supabaseAnonKey;

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('x-upsert', 'false');

      const knownSize = file instanceof File ? file.size : file.size;
      xhr.upload.onprogress = (e) => {
        if (!onProgress) return;
        if (e.lengthComputable && e.total > 0) {
          onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
        } else if (knownSize > 0) {
          onProgress(Math.min(99, Math.round((e.loaded / knownSize) * 100)));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve();
          return;
        }
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          if (body.message) message = body.message;
          else if (body.error) message = body.error;
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));

      const formData = new FormData();
      formData.append('cacheControl', '3600');
      formData.append('', file);
      xhr.send(formData);
    });
  });
}

export function getCommunityImagesPublicUrl(pathWithinBucket: string): string {
  const cleanPath = pathWithinBucket.replace(/^\/|\/$/g, '').replace(/\/+/g, '/');
  const { data } = supabase.storage.from(COMMUNITY_IMAGES_BUCKET).getPublicUrl(cleanPath);
  return data.publicUrl;
}
