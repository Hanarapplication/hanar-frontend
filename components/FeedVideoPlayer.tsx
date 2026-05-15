'use client';

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Volume2, VolumeX, Play, Pause, Maximize2, Minimize2 } from 'lucide-react';
import { releaseFeedVideoFullscreenPortalRoot, setFeedVideoFullscreenPortalRoot } from '@/lib/feedVideoFullscreenPortal';
import { eventTargetToNearestElement } from '@/lib/eventTargetElement';

interface FeedVideoPlayerProps {
  src: string;
  className?: string;
  /** Shown in a bottom dock while in fullscreen (likes / comments / share). */
  fullscreenActions?: ReactNode;
}

/**
 * Inline feed video: scales to column width while preserving native aspect ratio
 * (landscape wide, portrait tall). No letterboxing inside the frame — the video
 * element is sized to fit `max-w-full` / `max-h-[85vh]` proportionally.
 * Tap the video to enter fullscreen (then tap again to play/pause while fullscreen).
 */
export default function FeedVideoPlayer({
  src,
  className = '',
  fullscreenActions,
}: FeedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** iOS native video fullscreen — drives UI; ref kept for intersection observer */
  const [iosUiFullscreen, setIosUiFullscreen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** iOS Safari native video fullscreen — `document.fullscreenElement` stays null */
  const iosNativeFullscreenRef = useRef(false);

  const immersiveChrome = isFullscreen || iosUiFullscreen;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onBegin = () => {
      iosNativeFullscreenRef.current = true;
      setIosUiFullscreen(true);
    };
    const onEnd = () => {
      iosNativeFullscreenRef.current = false;
      setIosUiFullscreen(false);
    };
    video.addEventListener('webkitbeginfullscreen', onBegin);
    video.addEventListener('webkitendfullscreen', onEnd);
    return () => {
      video.removeEventListener('webkitbeginfullscreen', onBegin);
      video.removeEventListener('webkitendfullscreen', onEnd);
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const shouldIgnoreIntersection = () => {
      if (iosNativeFullscreenRef.current) return true;
      const fs = document.fullscreenElement;
      if (!fs) return false;
      return fs === container || fs === video || fs.contains(video);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (shouldIgnoreIntersection()) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            video.play().catch(() => {});
            setPlaying(true);
          } else {
            video.pause();
            setPlaying(false);
          }
        });
      },
      { threshold: [0, 0.6] }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
    };

    const onLoaded = () => {
      setDuration(video.duration);
    };

    const onEnded = () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      scheduleHide();
    }
  }, [playing, scheduleHide]);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
    scheduleHide();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    scheduleHide();
  };

  const enterFullscreenMode = useCallback(async (): Promise<boolean> => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return false;

    try {
      if (typeof container.requestFullscreen === 'function') {
        await container.requestFullscreen();
        setIsFullscreen(true);
        void video.play().catch(() => {});
        setPlaying(true);
        return true;
      }
    } catch {
      /* try video element */
    }

    try {
      if (typeof video.requestFullscreen === 'function') {
        await video.requestFullscreen();
        setIsFullscreen(true);
        void video.play().catch(() => {});
        setPlaying(true);
        return true;
      }
    } catch {
      /* iOS native */
    }

    const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (typeof v.webkitEnterFullscreen === 'function') {
      try {
        v.webkitEnterFullscreen();
        void video.play().catch(() => {});
        setPlaying(true);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const exitFullscreenMode = useCallback(async () => {
    const video = videoRef.current;
    if (iosNativeFullscreenRef.current && video) {
      const v = video as HTMLVideoElement & { webkitExitFullscreen?: () => void };
      try {
        if (typeof v.webkitExitFullscreen === 'function') {
          v.webkitExitFullscreen();
        }
      } catch {
        /* ignore */
      }
      setIsFullscreen(false);
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
    setIsFullscreen(false);
  }, []);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (document.fullscreenElement || iosNativeFullscreenRef.current) {
      void exitFullscreenMode();
    } else {
      void enterFullscreenMode();
    }
    scheduleHide();
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = eventTargetToNearestElement(e.target);
    if (target?.closest('button')) return;

    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const inFs =
      iosNativeFullscreenRef.current ||
      (document.fullscreenElement &&
        (document.fullscreenElement === container ||
          document.fullscreenElement === video ||
          document.fullscreenElement.contains(video)));

    if (inFs) {
      togglePlay(e);
      return;
    }

    e.preventDefault();
    void enterFullscreenMode();
    scheduleHide();
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      const fs = document.fullscreenElement;
      const c = containerRef.current;
      const v = videoRef.current;
      setIsFullscreen(!!(fs && c && (fs === c || fs === v || (v && fs.contains(v)))));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  /** So portalled UI (e.g. comments sheet) stays inside the native fullscreen subtree. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (immersiveChrome) {
      setFeedVideoFullscreenPortalRoot(el);
      return () => {
        releaseFeedVideoFullscreenPortalRoot(el);
      };
    }
    releaseFeedVideoFullscreenPortalRoot(el);
  }, [immersiveChrome]);

  const handleProgressClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    scheduleHide();
  };

  const formatTime = (s: number) => {
    const sec = Math.floor(s);
    return `0:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full cursor-pointer select-none [&:fullscreen]:flex [&:fullscreen]:min-h-dvh [&:fullscreen]:w-full [&:fullscreen]:items-center [&:fullscreen]:justify-center [&:fullscreen]:bg-black ${className}`}
      onClick={handleContainerClick}
      onMouseMove={scheduleHide}
      onTouchStart={scheduleHide}
    >
      <div className="flex w-full justify-center">
        <div
          className={`relative inline-block max-w-full ${
            isFullscreen ? 'max-h-[min(96vh,96dvh)]' : 'max-h-[85vh]'
          }`}
        >
          <video
            ref={videoRef}
            src={src}
            muted={muted}
            playsInline
            preload="metadata"
            className={`block h-auto w-auto max-w-full bg-transparent ${
              isFullscreen ? 'max-h-[min(96vh,96dvh)]' : 'max-h-[85vh]'
            }`}
          />

          {!playing && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
                <Play className="ml-0.5 h-7 w-7" fill="white" />
              </div>
            </div>
          )}

          <div
            className={`absolute inset-x-0 bottom-0 z-20 transition-opacity duration-300 ${
              showControls || !playing ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

            <div className="relative px-3 pb-2.5 pt-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="text-white transition hover:text-white/80"
                  >
                    {playing ? <Pause className="h-5 w-5" fill="white" /> : <Play className="ml-0.5 h-5 w-5" fill="white" />}
                  </button>
                  <span className="text-xs font-medium tabular-nums text-white/90">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="rounded-full bg-black/40 p-1.5 text-white transition hover:bg-black/60"
                    aria-label={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="rounded-full bg-black/40 p-1.5 text-white transition hover:bg-black/60"
                    aria-label={immersiveChrome ? 'Exit fullscreen' : 'Fullscreen'}
                  >
                    {immersiveChrome ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div
                ref={progressRef}
                className="mb-2 h-1 w-full cursor-pointer rounded-full bg-white/30"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {immersiveChrome && fullscreenActions ? (
                <div
                  className="mt-2 border-t border-white/20 pt-2"
                  role="toolbar"
                  aria-label="Post actions"
                >
                  <div className="flex justify-center">{fullscreenActions}</div>
                </div>
              ) : null}
            </div>
          </div>

          {playing && !showControls && (
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
                aria-label={immersiveChrome ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {immersiveChrome ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              {muted && (
                <button
                  type="button"
                  onClick={toggleMute}
                  className="rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
                >
                  <VolumeX className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
