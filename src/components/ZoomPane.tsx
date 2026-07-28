import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface ZoomPaneHandle {
  reset: () => void;
  /** The pannable/zoomable content element itself - i.e. `children`'s direct
   * wrapper, at its natural (untransformed) size, ignoring the pane's own
   * current pan/zoom and overflow clipping. Callers that need to capture the
   * full content (e.g. exporting to an image) should read this element's
   * `style.transform` off, snapshot, then restore it, rather than trying to
   * capture the outer (clipped, transformed) pane directly. */
  getContentElement: () => HTMLDivElement | null;
}

interface ZoomPaneProps {
  children: React.ReactNode;
  className?: string;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;
// Panning/pinching only "engages" (and only then captures the pointer) once
// movement clears this threshold — see the pointer handlers below.
const DRAG_THRESHOLD = 6;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function fitTransform(containerW: number, containerH: number, contentW: number, contentH: number): Transform {
  if (containerW <= 0 || containerH <= 0 || contentW <= 0 || contentH <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }
  const scale = clamp(Math.min(containerW / contentW, containerH / contentH), MIN_SCALE, MAX_SCALE);
  return {
    scale,
    x: (containerW - contentW * scale) / 2,
    y: (containerH - contentH * scale) / 2,
  };
}

const DEFAULT_CLASS_NAME =
  'relative w-full overflow-hidden touch-none select-none rounded-lg border border-gray-200 dark:border-gray-700 ' +
  'bg-gray-50/50 dark:bg-gray-900/30 cursor-grab active:cursor-grabbing h-[65vh] md:h-auto md:aspect-square';

/**
 * Wheel-to-zoom / drag-to-pan / pinch-to-zoom viewport for content that can
 * be much larger than the space available for it (the CCG flowchart tree).
 * Fits `children` to the viewport on first measurement and whenever either
 * the viewport or the content's natural (unscaled) size changes; `reset()`
 * (exposed via ref) returns to that fitted view.
 */
export const ZoomPane = forwardRef<ZoomPaneHandle, ZoomPaneProps>(function ZoomPane({ children, className }, ref) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [contentSize, setContentSize] = useState({ w: 0, h: 0 });
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [initialTransform, setInitialTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });

  // Re-fit whenever the viewport or the content's natural size changes —
  // e.g. the window resizes, "show team names" is toggled, or the tree
  // rebuilds after a pick — without calling setState directly inside an
  // effect (see React's "Resetting all state when a prop changes" pattern).
  const fitKey = `${containerSize.w}x${containerSize.h}|${contentSize.w}x${contentSize.h}`;
  const [lastFitKey, setLastFitKey] = useState(fitKey);
  if (fitKey !== lastFitKey) {
    setLastFitKey(fitKey);
    if (containerSize.w > 0 && containerSize.h > 0 && contentSize.w > 0 && contentSize.h > 0) {
      const fit = fitTransform(containerSize.w, containerSize.h, contentSize.w, contentSize.h);
      setTransform(fit);
      setInitialTransform(fit);
    }
  }

  useImperativeHandle(ref, () => ({
    reset: () => setTransform(initialTransform),
    getContentElement: () => contentRef.current,
  }));

  useEffect(() => {
    const outer = outerRef.current;
    const content = contentRef.current;
    if (!outer || !content) return;

    const outerObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    });
    const contentObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContentSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    });
    outerObserver.observe(outer);
    contentObserver.observe(content);
    return () => {
      outerObserver.disconnect();
      contentObserver.disconnect();
    };
  }, []);

  // Wheel-to-zoom, anchored at the cursor. Attached as a non-passive native
  // listener (rather than React's onWheel) because React's synthetic wheel
  // handler is passive, which silently ignores preventDefault() and would
  // let the page scroll underneath while zooming.
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = outer.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setTransform((t) => {
        const newScale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
        const cx = (mx - t.x) / t.scale;
        const cy = (my - t.y) / t.scale;
        return { scale: newScale, x: mx - cx * newScale, y: my - cy * newScale };
      });
    };
    outer.addEventListener('wheel', onWheel, { passive: false });
    return () => outer.removeEventListener('wheel', onWheel);
  }, []);

  // Pointer-based drag-to-pan and (with two active pointers) pinch-to-zoom.
  // Pointer Events fire for touch too, so this covers mobile pinch without
  // separate touch-event handling; `touch-action: none` (in the default
  // className) stops the browser's own scroll/pinch from competing with it.
  // Each gesture only "engages" — and only then captures the pointer — once
  // it clears DRAG_THRESHOLD; until then we touch neither, so a plain tap on
  // a team button underneath still fires its click instead of being
  // redirected to the pane (pointer capture retargets the eventual
  // mouseup/click to the capturing element).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef<{ x: number; y: number; transform: Transform; engaged: boolean } | null>(null);
  const pinchStart = useRef<{ dist: number; mid: { x: number; y: number }; transform: Transform; engaged: boolean } | null>(
    null
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, transform, engaged: false };
      pinchStart.current = null;
    } else if (pointers.current.size === 2) {
      dragStart.current = null;
      const [p1, p2] = [...pointers.current.values()];
      pinchStart.current = { dist: distance(p1, p2), mid: midpoint(p1, p2), transform, engaged: false };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const st = pinchStart.current;
      const [p1, p2] = [...pointers.current.values()];
      const dist = distance(p1, p2);
      const mid = midpoint(p1, p2);
      if (!st.engaged) {
        if (Math.abs(dist - st.dist) < DRAG_THRESHOLD && distance(mid, st.mid) < DRAG_THRESHOLD) return;
        st.engaged = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Best-effort — our own `pointers` map (not native capture) is what
          // actually drives the gesture from here.
        }
      }
      const rect = outerRef.current!.getBoundingClientRect();
      const ratio = dist / st.dist;
      const newScale = clamp(st.transform.scale * ratio, MIN_SCALE, MAX_SCALE);
      const startMidLocal = { x: st.mid.x - rect.left, y: st.mid.y - rect.top };
      const cx = (startMidLocal.x - st.transform.x) / st.transform.scale;
      const cy = (startMidLocal.y - st.transform.y) / st.transform.scale;
      const midLocal = { x: mid.x - rect.left, y: mid.y - rect.top };
      setTransform({ scale: newScale, x: midLocal.x - cx * newScale, y: midLocal.y - cy * newScale });
    } else if (pointers.current.size === 1 && dragStart.current) {
      const st = dragStart.current;
      const dx = e.clientX - st.x;
      const dy = e.clientY - st.y;
      if (!st.engaged) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        st.engaged = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Best-effort — see above.
        }
      }
      setTransform({ scale: st.transform.scale, x: st.transform.x + dx, y: st.transform.y + dy });
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinchStart.current = null;
    dragStart.current = null;
    if (pointers.current.size === 1) {
      const [[, p]] = [...pointers.current];
      dragStart.current = { x: p.x, y: p.y, transform, engaged: false };
    }
  };

  return (
    <div
      ref={outerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      className={className ?? DEFAULT_CLASS_NAME}
    >
      <div
        ref={contentRef}
        className="absolute top-0 left-0"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0' }}
      >
        {children}
      </div>
    </div>
  );
});
