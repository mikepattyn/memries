import { useCallback, useRef } from "react";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;

export function usePhotoPress({
  onOpen,
  onActions,
}: {
  onOpen: () => void;
  onActions?: () => void;
}) {
  const longPressRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!onActions || event.button !== 0) return;
      startRef.current = { x: event.clientX, y: event.clientY };
      suppressClickRef.current = false;
      clearLongPress();
      longPressRef.current = window.setTimeout(() => {
        longPressRef.current = null;
        suppressClickRef.current = true;
        onActions();
      }, LONG_PRESS_MS);
    },
    [clearLongPress, onActions],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!startRef.current || longPressRef.current === null) return;
      const dx = event.clientX - startRef.current.x;
      const dy = event.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        clearLongPress();
        startRef.current = null;
      }
    },
    [clearLongPress],
  );

  const onPointerUp = useCallback(() => {
    clearLongPress();
    startRef.current = null;
  }, [clearLongPress]);

  const onPointerCancel = useCallback(() => {
    clearLongPress();
    startRef.current = null;
  }, [clearLongPress]);

  const onClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen();
  }, [onOpen]);

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!onActions) return;
      event.preventDefault();
      suppressClickRef.current = true;
      onActions();
    },
    [onActions],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!onActions) return;
      if ((event.key === "F10" && event.shiftKey) || event.key === "ContextMenu") {
        event.preventDefault();
        onActions();
      }
    },
    [onActions],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClick,
    onContextMenu,
    onKeyDown,
  };
}
