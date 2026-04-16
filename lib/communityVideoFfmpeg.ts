import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Single shared FFmpeg.wasm instance (heavy — load once per session).
 */
export async function getLoadedFFmpeg(onLog?: (message: string) => void): Promise<FFmpeg> {
  if (loadPromise) {
    const ff = await loadPromise;
    return ff;
  }
  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message));
    }
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
  })();
  return loadPromise;
}

export type TranscodeClipOptions = {
  startSec: number;
  durationSec: number;
  /** Cap longest edge for smaller output (default 720). */
  maxWidth?: number;
};

/**
 * Trim + transcode to H.264/AAC MP4 for community upload (≤11s segment).
 */
export async function transcodeCommunityClip(
  ffmpeg: FFmpeg,
  file: File,
  opts: TranscodeClipOptions
): Promise<Blob> {
  const inputName = 'input';
  const outName = 'out.mp4';
  const mw = opts.maxWidth ?? 720;

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const tryH264 = async () => {
    await ffmpeg.exec([
      '-ss',
      String(Math.max(0, opts.startSec)),
      '-i',
      inputName,
      '-t',
      String(Math.max(0.1, opts.durationSec)),
      '-vf',
      `scale=${mw}:-2`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '28',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-y',
      outName,
    ]);
  };

  const tryMpeg4 = async () => {
    await ffmpeg.exec([
      '-ss',
      String(Math.max(0, opts.startSec)),
      '-i',
      inputName,
      '-t',
      String(Math.max(0.1, opts.durationSec)),
      '-vf',
      `scale=${mw}:-2`,
      '-c:v',
      'mpeg4',
      '-q:v',
      '4',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-y',
      outName,
    ]);
  };

  try {
    await tryH264();
  } catch {
    await ffmpeg.deleteFile(outName).catch(() => {});
    await tryMpeg4();
  }

  const data = await ffmpeg.readFile(outName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outName).catch(() => {});

  const raw = data instanceof Uint8Array ? data : new Uint8Array();
  const copy = new Uint8Array(raw.byteLength);
  copy.set(raw);
  return new Blob([copy], { type: 'video/mp4' });
}
