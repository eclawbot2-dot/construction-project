"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Textarea with a microphone button that uses Web Speech API
 * (webkitSpeechRecognition / SpeechRecognition) to transcribe speech
 * directly into the field. Big mobile-field win — supers and foremen
 * can dictate daily-log notes while walking the site.
 *
 * Falls back to a plain textarea on browsers without the API
 * (Firefox desktop, some embedded WebViews). The mic button is
 * hidden in that case rather than showing a broken affordance.
 *
 * Usage: <DictateTextarea name="body" defaultValue="..." />
 * Behaves like a normal <textarea>; just adds the mic affordance.
 */
type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  /** Optional callback when transcription updates the value. */
  onTranscript?: (text: string) => void;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function DictateTextarea({ onTranscript, defaultValue, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setSupported(!!Ctor);
  }, []);

  function toggle() {
    if (!supported || !ref.current) return;
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]!;
        const txt = r[0].transcript;
        if (r.isFinal) final += txt;
        else interim += txt;
      }
      const t = ref.current;
      if (!t) return;
      const base = (t.dataset.dictateBase ?? t.value).replace(/\s+$/, "");
      const next = `${base}${base ? " " : ""}${(final + interim).trim()}`;
      t.value = next;
      onTranscript?.(next);
      // Trigger a synthetic input event so React form state hooks (if
      // any wrap this) observe the change.
      t.dispatchEvent(new Event("input", { bubbles: true }));
    };
    rec.onend = () => {
      setRecording(false);
      if (ref.current) {
        ref.current.dataset.dictateBase = ref.current.value;
      }
    };
    rec.onerror = () => setRecording(false);
    if (ref.current) ref.current.dataset.dictateBase = ref.current.value;
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  return (
    <div className="relative">
      <textarea ref={ref} defaultValue={defaultValue} {...props} />
      {supported ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={recording ? "Stop dictation" : "Start dictation"}
          title={recording ? "Stop dictation" : "Dictate (Web Speech API)"}
          className={`absolute bottom-2 right-2 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] transition ${
            recording
              ? "border-rose-500 bg-rose-500/20 text-rose-200 animate-pulse"
              : "border-white/10 bg-white/5 text-slate-400 hover:border-cyan-500/40 hover:text-white"
          }`}
        >
          {recording ? "● rec" : "🎤 dictate"}
        </button>
      ) : null}
    </div>
  );
}
