'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 30;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function micError(e: unknown) {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'The microphone is blocked. Click the lock icon in the address bar, allow the microphone, then try again.';
  }
  if (name === 'NotFoundError') return 'No microphone found. Plug in a mic or headset and try again.';
  if (name === 'NotReadableError') return 'Another app is using the microphone. Close it and try again.';
  return e instanceof Error ? e.message : 'Could not start the microphone.';
}

/**
 * Records one line at a time from the microphone. start(key) begins, stop() ends and resolves `onDone(key, blob)`.
 * Stops by itself after 30 seconds. The microphone is released after every take.
 */
export function useRecorder(onDone: (key: string, blob: Blob) => void) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  }, []);

  const start = useCallback(async (key: string) => {
    setError(null);
    if (rec.current && rec.current.state !== 'inactive') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot record audio here. Use Chrome or Edge on http://localhost.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mimeType = pickMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      const began = Date.now();
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) window.clearInterval(timer.current);
        timer.current = null;
        rec.current = null;
        setActiveKey(null);
        done.current(key, new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      rec.current = recorder;
      recorder.start(250);
      setActiveKey(key);
      setSeconds(0);
      timer.current = window.setInterval(() => {
        const s = (Date.now() - began) / 1000;
        setSeconds(s);
        if (s >= MAX_SECONDS && recorder.state !== 'inactive') recorder.stop();
      }, 200);
    } catch (e) {
      setError(micError(e));
    }
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    },
    [],
  );

  return { activeKey, seconds, error, start, stop, clearError: () => setError(null) };
}
