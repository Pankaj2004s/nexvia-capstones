import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { api } from '../lib/api';

// Asks the API for a signed playback session, then plays the HLS master playlist with hls.js
// (Safari plays HLS natively). Quality switches automatically (adaptive bitrate).
export default function VideoPlayer({ lessonId, onEnded }) {
  const ref = useRef(null);
  const [state, setState] = useState({ phase: 'loading', message: '', progress: 0 });

  useEffect(() => {
    let hls; let cancelled = false; let poll;
    const load = async () => {
      setState({ phase: 'loading', message: '', progress: 0 });
      try {
        const { playback } = await api.get(`/lessons/${lessonId}/playback`);
        if (cancelled) return;
        if (playback.mode === 'cloudfront' && playback.cookies) {
          // CloudFront signed cookies must be set on a parent domain shared with the CDN hostname
          const domain = import.meta.env.VITE_CDN_COOKIE_DOMAIN;
          Object.entries(playback.cookies).forEach(([k, v]) => { document.cookie = `${k}=${v}; path=/; secure; samesite=none${domain ? `; domain=${domain}` : ''}`; });
        }
        const video = ref.current;
        if (Hls.isSupported()) {
          hls = new Hls({ xhrSetup: (xhr) => { if (playback.mode === 'cloudfront') xhr.withCredentials = true; } });
          hls.loadSource(playback.playlistUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) setState({ phase: 'error', message: 'Playback failed. Reload the page to try again.', progress: 0 }); });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = playback.playlistUrl;
        } else {
          setState({ phase: 'error', message: 'This browser cannot play HLS video.', progress: 0 });
          return;
        }
        setState({ phase: 'ready', message: '', progress: 100 });
      } catch (e) {
        if (cancelled) return;
        if (e.status === 409) {
          setState({ phase: 'processing', message: 'This video is still being prepared.', progress: (e.details && e.details.progress) || 0 });
          poll = setTimeout(load, 4000);
        } else if (e.status === 404) setState({ phase: 'empty', message: 'No video has been uploaded for this lesson yet.', progress: 0 });
        else setState({ phase: 'error', message: e.message, progress: 0 });
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(poll); if (hls) hls.destroy(); };
  }, [lessonId]);

  return (
    <div className="overflow-hidden rounded-panel bg-black">
      <div className="relative aspect-video">
        <video ref={ref} controls playsInline className={`h-full w-full ${state.phase === 'ready' ? '' : 'invisible'}`} onEnded={onEnded} />
        {state.phase !== 'ready' && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/90" role="status">
            <div>
              <p className="font-display text-lg font-semibold">{state.phase === 'loading' ? 'Loading video…' : state.message}</p>
              {state.phase === 'processing' && <p className="mt-1 text-sm text-white/70">Processing: {state.progress}%. This page updates on its own.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
