import { useEffect, useRef, useState, type RefObject } from "react";
import { useFocusManager } from "./FocusContext.js";

interface UseFocusableOptions {
  /** Focus this element immediately when it mounts (use for the first element on each screen). */
  autoFocus?: boolean;
}

export function useFocusable<T extends HTMLElement>(
  id: string,
  onSelect?: () => void,
  options: UseFocusableOptions = {},
): { ref: RefObject<T | null>; focused: boolean } {
  const manager = useFocusManager();
  const ref = useRef<T | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const unregister = manager.register(id, el, () => onSelectRef.current?.());
    if (options.autoFocus) manager.focus(id);
    const unsubscribe = manager.subscribe((focusedId) => setFocused(focusedId === id));
    return () => {
      unregister();
      unsubscribe();
    };
  // options.autoFocus and id are stable; manager comes from context and is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, id]);

  return { ref, focused };
}
