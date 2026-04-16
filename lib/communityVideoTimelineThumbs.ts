/**
 * Sample evenly spaced JPEG thumbnails across a video (for timeline filmstrip UI).
 * Uses the same blob URL as the preview player — do not revoke `objectUrl` here.
 */
export async function extractTimelineThumbnails(
  objectUrl: string,
  durationSec: number,
  tileCount = 14
): Promise<string[]> {
  if (!durationSec || durationSec <= 0 || !Number.isFinite(durationSec)) {
    return [];
  }

  const video = document.createElement('video');
  video.src = objectUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Video failed to load for thumbnails'));
  });

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 360;
  const thumbW = 80;
  const thumbH = Math.max(44, Math.round((vh / vw) * thumbW));

  const canvas = document.createElement('canvas');
  canvas.width = thumbW;
  canvas.height = thumbH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const urls: string[] = [];
  const n = Math.max(4, Math.min(tileCount, 20));

  const seekVideo = (time: number) =>
    new Promise<void>((resolve) => {
      const target = Math.min(Math.max(0, time), Math.max(0, durationSec - 0.02));
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('seeked', onSeeked);
        window.clearTimeout(timer);
        resolve();
      };
      const onSeeked = () => finish();
      const timer = window.setTimeout(finish, 900);
      video.addEventListener('seeked', onSeeked);
      video.currentTime = target;
    });

  for (let i = 0; i < n; i++) {
    const t = (durationSec * (i + 0.5)) / n;
    await seekVideo(t);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, thumbW, thumbH);
    ctx.drawImage(video, 0, 0, thumbW, thumbH);
    urls.push(canvas.toDataURL('image/jpeg', 0.62));
  }

  return urls;
}
