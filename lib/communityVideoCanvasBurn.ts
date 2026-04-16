export type BurnOverlaysOptions = {
  caption: string;
  stickerFile?: File | null;
};

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text.trim()) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      if (ctx.measureText(w).width > maxWidth) {
        let chunk = '';
        for (const ch of w) {
          const t = chunk + ch;
          if (ctx.measureText(t).width <= maxWidth) chunk = t;
          else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        line = chunk;
      } else {
        line = w;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Re-record video by painting each frame to a canvas with caption + optional sticker; keeps audio when possible.
 */
export async function burnOverlaysToWebm(videoBlob: Blob, opts: BurnOverlaysOptions): Promise<Blob> {
  const caption = opts.caption?.trim() || '';
  const stickerFile = opts.stickerFile;
  if (!caption && !stickerFile) {
    return videoBlob;
  }

  const video = document.createElement('video');
  video.src = URL.createObjectURL(videoBlob);
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Video load failed'));
  });

  const w = video.videoWidth || 720;
  const h = video.videoHeight || 1280;

  let sticker: HTMLImageElement | null = null;
  if (stickerFile) {
    sticker = new Image();
    sticker.crossOrigin = 'anonymous';
    sticker.src = URL.createObjectURL(stickerFile);
    await new Promise<void>((resolve, reject) => {
      sticker!.onload = () => resolve();
      sticker!.onerror = () => reject(new Error('Sticker load failed'));
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  const canvasStream = canvas.captureStream(30);
  const out = new MediaStream();
  canvasStream.getVideoTracks().forEach((t) => out.addTrack(t));

  try {
    const cap = (video as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream }).captureStream?.(30);
    const a = cap?.getAudioTracks?.()[0];
    if (a) out.addTrack(a);
  } catch {
    /* no audio */
  }

  const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  let mime = '';
  for (const m of mimeTypes) {
    if (MediaRecorder.isTypeSupported(m)) {
      mime = m;
      break;
    }
  }
  if (!mime) throw new Error('WebM recording not supported in this browser');

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: 2_500_000 });

  const drawFrame = () => {
    ctx.drawImage(video, 0, 0, w, h);
    if (sticker && sticker.complete) {
      const sw = Math.min(w * 0.24, sticker.width);
      const sh = sw * (sticker.height / sticker.width);
      ctx.drawImage(sticker, w - sw - 16, 16, sw, sh);
    }
    if (caption) {
      const fontSize = Math.max(22, Math.min(56, Math.floor(w / 18)));
      ctx.font = `${fontSize}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const padX = 20;
      const maxW = w - padX * 2;
      const lines = wrapLines(ctx, caption, maxW);
      let y = h - 20;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = Math.max(3, fontSize / 10);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeText(line, w / 2, y);
        ctx.fillText(line, w / 2, y);
        y -= fontSize + 10;
        if (y < fontSize) break;
      }
    }
  };

  return new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error('Recorder error'));
    recorder.onstop = () => {
      URL.revokeObjectURL(video.src);
      if (sticker?.src.startsWith('blob:')) URL.revokeObjectURL(sticker.src);
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };

    const stopAll = () => {
      if (recorder.state === 'recording') recorder.stop();
    };

    video.onended = () => stopAll();
    video.onerror = () => {
      stopAll();
      reject(new Error('Playback error'));
    };

    void (async () => {
      try {
        recorder.start(250);
        await video.play();
        const tick = () => {
          if (video.ended || video.paused) {
            if (video.ended) stopAll();
            return;
          }
          drawFrame();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        window.setTimeout(
          () => {
            if (recorder.state === 'recording') stopAll();
          },
          (video.duration + 2) * 1000
        );
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    })();
  });
}
