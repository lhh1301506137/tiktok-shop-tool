import { useState, useEffect, useCallback, useRef, RefObject } from 'react';

export interface VirtualItem {
  index: number;
  offsetTop: number;
}

interface UseVirtualListOptions {
  /** Total number of items */
  itemCount: number;
  /** Fixed height of each item in pixels */
  itemHeight: number;
  /** Number of extra items to render above/below the visible area */
  overscan?: number;
}

interface UseVirtualListReturn {
  /** Items currently visible (plus overscan) — render only these */
  virtualItems: VirtualItem[];
  /** Total height of the scrollable content in px */
  totalHeight: number;
  /** Scroll to a specific item index */
  scrollToIndex: (index: number) => void;
}

/**
 * Lightweight virtual scrolling hook for fixed-height items.
 * Attach containerRef to the scrollable container element.
 */
export function useVirtualList(
  containerRef: RefObject<HTMLElement | null>,
  options: UseVirtualListOptions
): UseVirtualListReturn {
  const { itemCount, itemHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Track container size via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setContainerHeight(el.clientHeight);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use clientHeight for consistency (includes padding, like initial measurement)
        setContainerHeight((entry.target as HTMLElement).clientHeight);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  // Track scroll position with rAF throttling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
        rafRef.current = null;
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [containerRef]);

  const totalHeight = itemCount * itemHeight;

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemCount - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const virtualItems: VirtualItem[] = [];
  for (let i = startIndex; i <= endIndex && i < itemCount; i++) {
    virtualItems.push({
      index: i,
      offsetTop: i * itemHeight,
    });
  }

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTop = Math.max(0, Math.min(index * itemHeight, totalHeight - containerHeight));
    },
    [containerRef, itemHeight, totalHeight, containerHeight]
  );

  return { virtualItems, totalHeight, scrollToIndex };
}
