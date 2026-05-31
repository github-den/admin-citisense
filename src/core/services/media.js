import { supabase } from '@core/lib/supabase.js';

const IMAGE_BUCKET = 'post-images';
const VIDEO_BUCKET = 'post-videos';

function safeName(name) {
  return String(name ?? 'media')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'media';
}

export async function uploadMediaFiles(files = [], { ownerId = 'anonymous', folder = 'discussion' } = {}) {
  if (!supabase || files.length === 0) return { data: [], error: null };

  const urls = [];
  for (const file of files) {
    const isVideoFile = file.type?.startsWith('video/');
    const targetBucket = isVideoFile ? VIDEO_BUCKET : IMAGE_BUCKET;
    const path = `${folder}/${ownerId}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;

    const { error } = await supabase.storage
      .from(targetBucket)
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || undefined,
        upsert: false,
      });

    if (error) return { data: urls, error };

    const { data } = supabase.storage.from(targetBucket).getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }

  return { data: urls, error: null };
}
