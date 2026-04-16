'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Loader2, Pause, Play, Scissors, Smile, X } from 'lucide-react';
import { burnOverlaysToWebm } from '@/lib/communityVideoCanvasBurn';
import { getLoadedFFmpeg, transcodeCommunityClip } from '@/lib/communityVideoFfmpeg';
import { extractTimelineThumbnails } from '@/lib/communityVideoTimelineThumbs';
import { cn } from '@/lib/utils';

const DEFAULT_MAX_SEC = 11;

type Props = {
  file: File;
  maxSegmentSec?: number;
  onDone: (file: File) => void;
  onCancel: () => void;
  /** Tighter spacing when embedded in home / modal composer */
  compact?: boolean;
};

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration || 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(v.src);
      reject(new Error('metadata'));
    };
    v.src = URL.createObjectURL(file);
  });
}

export default function CommunityVideoStudio({
  file,
  maxSegmentSec = DEFAULT_MAX_SEC,
  onDone,
  onCancel,
  compact = false,
}: Props) {
  const [duration, setDuration] = useState<number | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [phase, setPhase] = useState<'trim' | 'working' | 'decorate'>('trim');
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null);
  const [caption, setCaption] = useState('');
  const [stickerFile, setStickerFile] = useState<File | null>(null);
  const [stickerPreview, setStickerPreview] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [logLine, setLogLine] = useState('');
  const [err, setErr] = useState('');
  const [previewPlaying, setPreviewPlaying] = useState(true);

  const trimVideoRef = useRef<HTMLVideoElement>(null);
  const trackInnerRef = useRef<HTMLDivElement>(null);
  const dragOffsetFrac = useRef(0);
  const [trackDragging, setTrackDragging] = useState(false);
  const [timelineThumbs, setTimelineThumbs] = useState<string[] | null>(null);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  /** Playhead position on full timeline (0–100%) for strip under video. */
  const [playheadPct, setPlayheadPct] = useState(0);

  const maxStart = useMemo(() => {
    if (duration == null) return 0;
    return Math.max(0, duration - maxSegmentSec);
  }, [duration, maxSegmentSec]);

  const segmentLen = useMemo(() => {
    if (duration == null) return maxSegmentSec;
    return Math.min(maxSegmentSec, duration - trimStart);
  }, [duration, trimStart, maxSegmentSec]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await readVideoDuration(file);
        if (!cancelled) setDuration(d);
      } catch {
        if (!cancelled) setErr('Could not read video length.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!stickerFile) {
      setStickerPreview(null);
      return;
    }
    const url = URL.createObjectURL(stickerFile);
    setStickerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [stickerFile]);

  const onEmojiPick = useCallback((d: EmojiClickData) => {
    setCaption((c) => (c + d.emoji));
    setShowEmoji(false);
  }, []);

  const runTrim = useCallback(async () => {
    setErr('');
    setPhase('working');
    setLogLine('Loading editor…');
    try {
      const ffmpeg = await getLoadedFFmpeg((m) => setLogLine(m.split('\n').pop() || m));
      setLogLine('Encoding clip (may take a minute)…');
      const blob = await transcodeCommunityClip(ffmpeg, file, {
        startSec: trimStart,
        durationSec: segmentLen,
        maxWidth: 720,
      });
      setTrimmedBlob(blob);
      setPhase('decorate');
      setLogLine('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Encoding failed.');
      setPhase('trim');
    }
  }, [file, trimStart, segmentLen]);

  const finalize = useCallback(async () => {
    if (!trimmedBlob) return;
    setErr('');
    setPhase('working');
    setLogLine('Applying stickers & text…');
    try {
      let outBlob: Blob = trimmedBlob;
      if (caption.trim() || stickerFile) {
        outBlob = await burnOverlaysToWebm(trimmedBlob, { caption, stickerFile });
      }
      const ext = outBlob.type.includes('webm') ? 'webm' : 'mp4';
      const name = `community-edit-${Date.now()}.${ext}`;
      const outFile = new File([outBlob], name, { type: outBlob.type || `video/${ext}` });
      onDone(outFile);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed.');
      setPhase('decorate');
    } finally {
      setLogLine('');
    }
  }, [trimmedBlob, caption, stickerFile, onDone]);

  const previewUrlTrim = useMemo(
    () => (trimmedBlob ? URL.createObjectURL(trimmedBlob) : null),
    [trimmedBlob]
  );
  useEffect(() => {
    return () => {
      if (previewUrlTrim) URL.revokeObjectURL(previewUrlTrim);
    };
  }, [previewUrlTrim]);

  const previewUrlRaw = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrlRaw);
  }, [previewUrlRaw]);

  /** Filmstrip frames under the trim bar (same blob URL as main preview). */
  useEffect(() => {
    if (phase !== 'trim' || duration == null || duration <= 0) return;
    let cancelled = false;
    setThumbsLoading(true);
    setTimelineThumbs(null);
    (async () => {
      try {
        const thumbs = await extractTimelineThumbnails(previewUrlRaw, duration, 14);
        if (!cancelled) setTimelineThumbs(thumbs);
      } catch {
        if (!cancelled) setTimelineThumbs([]);
      } finally {
        if (!cancelled) setThumbsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, duration, previewUrlRaw]);

  /** Keep preview inside [trimStart, trimStart + segmentLen) like Shorts / Reels. */
  useEffect(() => {
    const v = trimVideoRef.current;
    if (!v || duration == null || phase !== 'trim') return;
    const end = trimStart + segmentLen;
    const guard = () => {
      if (v.currentTime < trimStart - 0.02) v.currentTime = trimStart;
      else if (v.currentTime >= end - 0.04) v.currentTime = trimStart;
    };
    v.addEventListener('timeupdate', guard);
    return () => v.removeEventListener('timeupdate', guard);
  }, [trimStart, segmentLen, duration, phase]);

  /** Whenever the kept window moves, preview always starts from the beginning of that window. */
  useEffect(() => {
    const v = trimVideoRef.current;
    if (!v || duration == null || phase !== 'trim') return;
    v.currentTime = trimStart;
  }, [trimStart, duration, phase]);

  useEffect(() => {
    const v = trimVideoRef.current;
    if (!v || phase !== 'trim') return;
    const onPlay = () => setPreviewPlaying(true);
    const onPause = () => setPreviewPlaying(false);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [phase, previewUrlRaw]);

  useEffect(() => {
    const v = trimVideoRef.current;
    if (!v || duration == null || phase !== 'trim' || duration <= 0) return;
    const sync = () => {
      setPlayheadPct(Math.min(100, Math.max(0, (v.currentTime / duration) * 100)));
    };
    sync();
    v.addEventListener('timeupdate', sync);
    v.addEventListener('seeked', sync);
    return () => {
      v.removeEventListener('timeupdate', sync);
      v.removeEventListener('seeked', sync);
    };
  }, [duration, phase, previewUrlRaw, trimStart]);

  const windowLeftPct = useMemo(() => {
    if (!duration) return 0;
    return (trimStart / duration) * 100;
  }, [trimStart, duration]);

  const windowWidthPct = useMemo(() => {
    if (!duration) return 100;
    return Math.min(100, (segmentLen / duration) * 100);
  }, [segmentLen, duration]);

  const setTrimFromClientX = useCallback(
    (clientX: number, offsetFracInWindow: number) => {
      const el = trackInnerRef.current;
      if (!el || duration == null) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const frac = Math.max(0, Math.min(1, x / rect.width));
      const ww = segmentLen / duration;
      let startFrac = frac - offsetFracInWindow * ww;
      startFrac = Math.max(0, Math.min(1 - ww, startFrac));
      setTrimStart(startFrac * duration);
    },
    [duration, segmentLen]
  );

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (duration == null) return;
      const inner = trackInnerRef.current;
      if (!inner) return;
      const rect = inner.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const frac = Math.max(0, Math.min(1, x / rect.width));
      const ww = segmentLen / duration;
      const leftFrac = trimStart / duration;
      const rightFrac = leftFrac + ww;
      const inside = frac >= leftFrac && frac <= rightFrac;
      if (inside) {
        dragOffsetFrac.current = (frac - leftFrac) / ww;
      } else {
        dragOffsetFrac.current = 0.5;
        setTrimFromClientX(e.clientX, 0.5);
      }
      setTrackDragging(true);
      inner.setPointerCapture(e.pointerId);
    },
    [duration, segmentLen, trimStart, setTrimFromClientX]
  );

  useEffect(() => {
    if (!trackDragging) return;
    const onMove = (e: PointerEvent) => {
      setTrimFromClientX(e.clientX, dragOffsetFrac.current);
    };
    const onUp = (e: PointerEvent) => {
      trackInnerRef.current?.releasePointerCapture(e.pointerId);
      setTrackDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [trackDragging, setTrimFromClientX]);

  return (
    <div
      className={cn(
        'rounded-xl border border-indigo-200 bg-indigo-50/40 dark:border-indigo-800/60 dark:bg-indigo-950/25',
        compact ? 'mt-1.5 space-y-2 p-2.5' : 'mt-3 space-y-4 p-4'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Edit video before posting</h3>
          <p className="mt-0.5 text-xs text-indigo-800/80 dark:text-indigo-300/90">
            Trim to {maxSegmentSec}s, add caption or emoji, optional corner picture — then upload.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-full p-1 text-indigo-700 hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      {phase === 'trim' && !err && (
        <>
          <div className="relative min-h-[220px] overflow-hidden rounded-xl border border-slate-700 bg-black shadow-inner dark:border-slate-600">
            <video
              ref={trimVideoRef}
              key={previewUrlRaw}
              src={previewUrlRaw}
              className="block max-h-[min(52vh,420px)] w-full object-contain"
              playsInline
              muted
              loop={false}
              autoPlay
            />

            {duration == null && (
              <div className="absolute inset-0 z-25 flex flex-col items-center justify-center gap-2 bg-black/60 px-4 backdrop-blur-[2px]">
                <Loader2 className="h-10 w-10 shrink-0 animate-spin text-white" aria-hidden />
                <p className="text-center text-sm font-semibold text-white">Loading video…</p>
                <p className="text-center text-xs text-white/75">Preview appears as soon as the file is ready.</p>
              </div>
            )}

            {duration != null && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const v = trimVideoRef.current;
                    if (!v) return;
                    if (v.paused) {
                      void v.play();
                      setPreviewPlaying(true);
                    } else {
                      v.pause();
                      setPreviewPlaying(false);
                    }
                  }}
                  className="absolute right-2 top-2 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow backdrop-blur-sm hover:bg-black/75"
                  aria-label={previewPlaying ? 'Pause preview' : 'Play preview'}
                >
                  {previewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
                </button>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-2 pb-2 pt-10">
              <p className="mb-1.5 text-center text-[10px] font-semibold text-white/90">
                Live preview: {segmentLen.toFixed(1)}s (loops){' '}
                <span className="text-white/70">
                  · {trimStart.toFixed(1)}s–{(trimStart + segmentLen).toFixed(1)}s
                </span>
              </p>
              <div className="pointer-events-auto relative mx-auto w-full max-w-full rounded-lg bg-slate-900/95 p-1.5 ring-1 ring-white/15">
                <div className="mb-1 flex items-center justify-between px-0.5 text-[9px] font-bold uppercase tracking-wide text-white/55">
                  <span>Drag window</span>
                  <span>
                    {maxStart > 0 ? `${segmentLen.toFixed(1)}s kept` : 'Full clip'} · arrows nudge
                  </span>
                </div>
                <div
                  ref={trackInnerRef}
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={maxStart}
                  aria-valuenow={Math.round(trimStart * 10) / 10}
                  aria-label="Choose which part of the video to keep"
                  tabIndex={0}
                  onPointerDown={onTrackPointerDown}
                  onKeyDown={(e) => {
                    if (duration == null || maxStart <= 0) return;
                    const step = Math.min(0.25, maxStart / 40);
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      setTrimStart((t) => Math.max(0, t - step));
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      setTrimStart((t) => Math.min(maxStart, t + step));
                    }
                  }}
                  className="relative h-[3.25rem] w-full cursor-grab touch-none overflow-hidden rounded-md bg-slate-950 select-none ring-1 ring-slate-600/80 active:cursor-grabbing"
                >
                  <div className="pointer-events-none absolute inset-0 flex">
                    {timelineThumbs && timelineThumbs.length > 0 ? (
                      timelineThumbs.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt=""
                          className="h-full min-h-0 flex-1 object-cover"
                          draggable={false}
                        />
                      ))
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-[9px] font-medium text-slate-400">
                        {thumbsLoading ? 'Loading frames…' : 'No preview strip'}
                      </div>
                    )}
                  </div>

                  {windowLeftPct > 0.05 && (
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 bg-black/60 backdrop-blur-[0.5px]"
                      style={{ width: `${windowLeftPct}%` }}
                    />
                  )}
                  {windowLeftPct + windowWidthPct < 99.95 && (
                    <div
                      className="pointer-events-none absolute inset-y-0 bg-black/60 backdrop-blur-[0.5px]"
                      style={{
                        left: `${windowLeftPct + windowWidthPct}%`,
                        width: `${100 - windowLeftPct - windowWidthPct}%`,
                      }}
                    />
                  )}
                  <div
                    className="pointer-events-none absolute inset-y-0 rounded-sm border-2 border-amber-400 ring-2 ring-amber-200/40"
                    style={{
                      left: `${windowLeftPct}%`,
                      width: `${windowWidthPct}%`,
                      boxShadow:
                        'inset 0 0 0 9999px rgba(251,191,36,0.14), 0 0 0 1px rgba(0,0,0,0.45)',
                    }}
                  >
                    <div className="absolute left-0 top-0 flex h-full w-2.5 items-center justify-center rounded-l-sm bg-amber-400/95">
                      <span className="block h-5 w-1 rounded-full bg-amber-950/85" />
                    </div>
                    <div className="absolute right-0 top-0 flex h-full w-2.5 items-center justify-center rounded-r-sm bg-amber-400/95">
                      <span className="block h-5 w-1 rounded-full bg-amber-950/85" />
                    </div>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                      {segmentLen.toFixed(1)}s
                    </span>
                  </div>

                  <div
                    className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_6px_rgba(255,255,255,0.95)]"
                    style={{ left: `${playheadPct}%`, transform: 'translateX(-50%)' }}
                    aria-hidden
                  />
                </div>
              </div>
            </div>
              </>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            {(file.size / (1024 * 1024)).toFixed(1)} MB
            {duration != null ? ` · ${duration.toFixed(1)}s total` : ' · reading length…'}
          </p>

          <button
            type="button"
            onClick={() => void runTrim()}
            disabled={duration == null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Scissors className="h-4 w-4" />
            Trim &amp; prepare clip
          </button>
        </>
      )}

      {phase === 'decorate' && trimmedBlob && previewUrlTrim && (
        <>
          <div className="rounded-lg border border-indigo-100 bg-black/90 dark:border-indigo-900/40">
            <video src={previewUrlTrim} controls className="max-h-48 w-full object-contain" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Caption on video</label>
            <div className="relative mt-1">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="Write or paste emoji…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowEmoji((s) => !s)}
                className="absolute bottom-2 right-2 rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Emoji"
              >
                <Smile className="h-4 w-4" />
              </button>
            </div>
            {showEmoji && (
              <div className="relative z-20 mt-2 flex justify-center">
                <EmojiPicker theme={Theme.AUTO} onEmojiClick={onEmojiPick} width="100%" height={360} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Picture on video (optional)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-indigo-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-indigo-800 dark:text-gray-400 dark:file:bg-indigo-900/40 dark:file:text-indigo-200"
              onChange={(e) => setStickerFile(e.target.files?.[0] || null)}
            />
            {stickerPreview && (
              <img src={stickerPreview} alt="" className="mt-2 h-16 w-auto rounded border border-slate-200 dark:border-gray-600" />
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void finalize()}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700"
            >
              {caption.trim() || stickerFile ? 'Burn text/picture & use video' : 'Use this clip'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTrimmedBlob(null);
                setPhase('trim');
                setCaption('');
                setStickerFile(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Back to trim
            </button>
          </div>
        </>
      )}

      {phase === 'working' && (
        <div className="flex flex-col items-center gap-2 py-6 text-sm text-indigo-900 dark:text-indigo-200">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-center font-medium">{logLine || 'Working…'}</span>
        </div>
      )}

    </div>
  );
}
