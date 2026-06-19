import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_BALANCE, STORAGE_KEY } from "@/constants/game";

export function useBalance() {
  const [balance, setBalance] = useState(DEFAULT_BALANCE);
  const [loaded, setLoaded] = useState(false);
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  // set once the user changes their balance locally, so a slow hydration read
  // can't clobber an in-session mutation.
  const mutatedRef = useRef(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const parsed = raw != null ? Number(raw) : NaN;
        if (Number.isFinite(parsed) && !mutatedRef.current) setBalance(parsed);
        setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: number) => {
    mutatedRef.current = true;
    balanceRef.current = next;
    setBalance(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
  }, []);

  const adjust = useCallback(
    (delta: number) => persist(balanceRef.current + delta),
    [persist],
  );

  return { balance, setBalance: persist, adjust, loaded };
}
