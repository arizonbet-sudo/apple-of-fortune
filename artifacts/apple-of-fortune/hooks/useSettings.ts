import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_SETTINGS, Settings, SETTINGS_KEY } from "@/constants/game";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(settings);
  ref.current = settings;
  const mutatedRef = useRef(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw && !mutatedRef.current) {
          try {
            const parsed = JSON.parse(raw);
            setSettings({ ...DEFAULT_SETTINGS, ...parsed });
          } catch {
            // ignore malformed persisted settings
          }
        }
        setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: Settings) => {
    mutatedRef.current = true;
    ref.current = next;
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const set = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      persist({ ...ref.current, [key]: value });
    },
    [persist],
  );

  const reset = useCallback(() => {
    persist({ ...DEFAULT_SETTINGS });
  }, [persist]);

  return { settings, set, reset, loaded };
}
