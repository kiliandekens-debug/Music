"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AUDIO_KIND_LABEL } from "@/lib/constants";
import { formatClock } from "@/lib/format";
import { getMediaUrl } from "@/lib/storage";
import { IconButton, Select, cn } from "@/components/ui";
import { IconPause, IconPlay, IconVolume } from "@/components/ui/icons";
import type { AudioVersion } from "@/lib/types";

interface AudioContextValue {
  versions: AudioVersion[];
  current: AudioVersion | null;
  currentId: string | null;
  select: (versionId: string) => void;
  playing: boolean;
  currentTime: number;
  duration: number;
  toggle: () => void;
  /** Place la lecture à un instant précis, en secondes. */
  seek: (seconds: number, autoplay?: boolean) => void;
  /** Positionne le lecteur sur une version et un instant (clic sur une correction). */
  goTo: (versionId: string, seconds: number) => void;
  ready: boolean;
  error: string | null;
}

const AudioPlayerContext = createContext<AudioContextValue | null>(null);

/**
 * Moteur audio partagé par les onglets « Versions audio » et « Corrections » :
 * cliquer une correction déplace le même lecteur au bon horodatage.
 */
export function AudioPlayerProvider({
  versions,
  children,
}: {
  versions: AudioVersion[];
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const shouldPlay = useRef(false);

  const playable = useMemo(() => versions.filter((v) => v.file_path), [versions]);

  // Sélection par défaut : la version principale, sinon la plus récente.
  useEffect(() => {
    if (currentId && playable.some((v) => v.id === currentId)) return;
    const main = playable.find((v) => v.is_main) ?? playable[0];
    setCurrentId(main?.id ?? null);
  }, [playable, currentId]);

  const current = useMemo(
    () => playable.find((v) => v.id === currentId) ?? null,
    [playable, currentId],
  );

  // Chargement de la source signée à chaque changement de version.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    setCurrentTime(0);
    setDuration(0);

    if (!current?.file_path) {
      if (audioRef.current) audioRef.current.removeAttribute("src");
      return;
    }

    getMediaUrl(current.file_path)
      .then((url) => {
        if (cancelled || !audioRef.current) return;
        audioRef.current.src = url;
        audioRef.current.load();
      })
      .catch(() => {
        if (!cancelled) setError("Fichier audio indisponible");
      });

    return () => {
      cancelled = true;
    };
  }, [current?.file_path, current?.id]);

  const select = useCallback((versionId: string) => {
    shouldPlay.current = false;
    pendingSeek.current = null;
    setPlaying(false);
    setCurrentId(versionId);
  }, []);

  const seek = useCallback((seconds: number, autoplay = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isFinite(audio.duration) || audio.readyState < 1) {
      pendingSeek.current = seconds;
      shouldPlay.current = autoplay;
      return;
    }
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
    setCurrentTime(audio.currentTime);
    if (autoplay) void audio.play().catch(() => undefined);
  }, []);

  const goTo = useCallback(
    (versionId: string, seconds: number) => {
      if (versionId !== currentId) {
        setCurrentId(versionId);
        pendingSeek.current = seconds;
        shouldPlay.current = true;
        return;
      }
      seek(seconds, true);
    },
    [currentId, seek],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current?.file_path) return;
    if (audio.paused) void audio.play().catch(() => setError("Lecture impossible"));
    else audio.pause();
  }, [current?.file_path]);

  const value = useMemo<AudioContextValue>(
    () => ({
      versions: playable,
      current,
      currentId,
      select,
      playing,
      currentTime,
      duration,
      toggle,
      seek,
      goTo,
      ready,
      error,
    }),
    [playable, current, currentId, select, playing, currentTime, duration, toggle, seek, goTo, ready, error],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          setReady(true);
          if (pendingSeek.current !== null) {
            audio.currentTime = Math.min(pendingSeek.current, audio.duration || 0);
            pendingSeek.current = null;
            if (shouldPlay.current) {
              shouldPlay.current = false;
              void audio.play().catch(() => undefined);
            }
          }
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          if (current?.file_path) setError("Lecture impossible");
        }}
      />
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer doit être utilisé à l'intérieur de AudioPlayerProvider");
  }
  return context;
}

const RATES = [0.75, 1, 1.25, 1.5];

/** Lecteur audio compact : lecture, position, volume, vitesse, choix de version. */
export function AudioPlayer({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { versions, current, currentId, select, playing, currentTime, duration, toggle, seek, error } =
    useAudioPlayer();
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);

  // Le volume et la vitesse s'appliquent à l'élément audio partagé.
  useEffect(() => {
    const audio = document.querySelector("audio");
    if (audio) {
      audio.volume = volume;
      audio.playbackRate = rate;
    }
  }, [volume, rate, currentId]);

  // Sans fichier, le lecteur n'a rien à montrer : la section qui l'entoure dit
  // déjà qu'aucune version n'existe, inutile de le répéter dans un encadré.
  if (versions.length === 0) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("card p-3", className)}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Lecture"}
          className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-[filter] hover:brightness-110"
        >
          {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] font-medium text-ink">
              {current?.name ?? "—"}
              {current ? (
                <span className="ml-1.5 text-[11px] font-normal text-faint">
                  {AUDIO_KIND_LABEL[current.kind]}
                </span>
              ) : null}
            </p>
            <span className="tabular shrink-0 text-[11px] text-muted">
              {formatClock(currentTime)} / {formatClock(duration || current?.duration_seconds || 0)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Position de lecture"
            className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--accent)]"
            style={{
              background: `linear-gradient(to right, var(--accent) ${progress}%, var(--color-surface-3) ${progress}%)`,
            }}
          />
        </div>
      </div>

      {!compact ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <IconVolume size={16} className="shrink-0 text-faint" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--accent)]"
            />
          </div>

          <div className="flex items-center gap-1">
            {RATES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRate(value)}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] transition-colors",
                  rate === value ? "bg-surface-3 text-ink" : "text-faint hover:text-ink-soft",
                )}
              >
                {value}×
              </button>
            ))}
          </div>

          {versions.length > 1 ? (
            <Select
              value={currentId ?? ""}
              onChange={(e) => select(e.target.value)}
              aria-label="Version à écouter"
              className="ml-auto w-auto min-w-40"
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

/** Bouton de lecture minimal, réutilisable dans une liste. */
export function SeekButton({
  versionId,
  seconds,
  children,
  className,
}: {
  versionId: string;
  seconds: number;
  children: React.ReactNode;
  className?: string;
}) {
  const { goTo } = useAudioPlayer();
  return (
    <button
      type="button"
      onClick={() => goTo(versionId, seconds)}
      className={cn("tabular text-accent hover:underline", className)}
    >
      {children}
    </button>
  );
}

export { formatClock as formatTimecode };
