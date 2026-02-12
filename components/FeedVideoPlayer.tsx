'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';

interface FeedVideoPlayerProps {
  src: string;
  className?: string;
}

/**
 * Facebook-style inline video player.
 * - Reads the video's native aspect ratio and sizes the container to match (no black bars).
 * - Caps very tall portrait videos at 4:5 so they don't dominate the feed.
 * - Caps very wide landscape videos at 2:1.
 */
export default function FeedVideoPlayer({
  src,
  className = '',
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
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-play when visible in viewport (IntersectionObserver)
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
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

  // Read native aspect ratio + time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
    };

    const onLoaded = () => {
      setDuration(video.duration);

      // Read native dimensions and compute aspect ratio (width / height)
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        let ratio = w / h;
        // Cap: min 4:5 (portrait) to max 2:1 (ultra-wide)
        ratio = Math.max(4 / 5, Math.min(2, ratio));
        setAspectRatio(ratio);
      }
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
  }, []);

  // Auto-hide controls
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

  // Before we know the aspect ratio, use 16:9 as a placeholder to avoid layout shift
  const containerStyle: React.CSSProperties = {
    aspectRatio: aspectRatio ? `${aspectRatio}` : '16 / 9',
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-black cursor-pointer select-none ${className}`}
      style={containerStyle}
      onClick={togglePlay}
      onMouseMove={scheduleHide}
      onTouchStart={scheduleHide}
    >
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Big play button when paused */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
            <Play className="h-7 w-7 ml-0.5" fill="white" />
          </div>
        </div>
      )}

      {/* Controls overlay - bottom */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${
          showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        <div className="relative px-3 pb-2.5 pt-6">
          {/* Progress bar */}
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

          {/* Bottom row: play/pause, time, mute */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="text-white hover:text-white/80 transition"
              >
                {playing ? <Pause className="h-5 w-5" fill="white" /> : <Play className="h-5 w-5 ml-0.5" fill="white" />}
              </button>
              <span className="text-xs font-medium text-white/90 tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mute badge - top right, always visible when muted & playing */}
      {playing && muted && !showControls && (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute top-3 right-3 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
        >
          <VolumeX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
