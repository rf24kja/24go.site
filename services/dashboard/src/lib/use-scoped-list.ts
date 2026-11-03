"use client";
import { useEffect, useRef, useState } from "react";

// Bind completions to the rendered identity, not the identity of an old callback.
export function useRequestScope(token: string | null | undefined, platform: string) {
  const current = useRef({ token, platform });
  if (current.current.token !== token || current.current.platform !== platform) current.current = { token, platform };
  useEffect(() => () => { current.current = { token: undefined, platform: "" }; }, []);
  return () => {
    const snapshot = current.current;
    return () => !!snapshot.token && current.current === snapshot;
  };
}

export function useScopedList<T>(token: string | null | undefined, platform: string, read: (token: string, options: { platform: string }) => Promise<any>) {
  const capture = useRequestScope(token, platform);
  const generation = useRef(0);
  const [state, setState] = useState<{ token: string | null | undefined; platform: string; items: T[]; loading: boolean; failed: boolean }>({ token, platform, items: [], loading: !!token, failed: false });
  const visible = state.token === token && state.platform === platform;
  const load = async () => {
    const valid = capture();
    const request = ++generation.current;
    if (!token) return;
    setState(old => ({ token, platform, items: old.token === token && old.platform === platform ? old.items : [], loading: true, failed: false }));
    try {
      const result = await read(token, { platform });
      if (!valid() || request !== generation.current) return;
      setState({ token, platform, items: result.items || result, loading: false, failed: false });
    } catch {
      if (!valid() || request !== generation.current) return;
      setState(old => ({ ...old, loading: false, failed: true }));
    }
  };
  useEffect(() => { void load(); }, [token, platform]);
  return { items: visible && token ? state.items : [], loading: !!token && (!visible || state.loading), failed: visible && state.failed, load, capture };
}
