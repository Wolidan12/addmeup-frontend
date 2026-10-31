import { useEffect, useRef, useState } from "react";

// Desktop sidebars become keyboard-contained modal navigation on small screens.
export function useNavigationDrawer(open, close) {
  const ref = useRef(null),
    closeRef = useRef(close);
  closeRef.current = close;
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)"),
      update = () => setNarrow(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || !narrow || !ref.current) return;
    const previous = document.activeElement,
      previousOverflow = document.body.style.overflow;
    const focusable = () =>
      [
        ...ref.current.querySelectorAll(
          'a[href],button:not(:disabled),input:not(:disabled),[tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
    focusable()[0]?.focus();
    document.body.style.overflow = "hidden";
    function keydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !ref.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !ref.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, narrow]);
  return { ref, narrow };
}
