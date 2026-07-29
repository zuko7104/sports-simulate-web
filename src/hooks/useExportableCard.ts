import { useCallback, useRef, useState } from 'react';
import { inlineImagesForExport, resolveEffectiveBackground, downloadElementAsPng } from '../utils/exportImages';

/**
 * Shared "download this card as a PNG" behavior - mirrors the capture
 * technique already used on the Flowchart page (CCGFlowchart /
 * CCGWaysToLockTable): inline every <img> to a data: URI first (so
 * cross-origin logos don't taint the capture), resolve the card's actual
 * background color, then hand off to modern-screenshot.
 *
 * `contentRef` belongs on the *outer* `.card` element itself (not just an
 * inner wrapper) so the card's own padding is captured along with its
 * content - an inner div has no padding of its own, so capturing only that
 * would crop the image flush against the text/table with none of the
 * surrounding gutter visible on screen.
 *
 * `hideOnExport` is a ref callback for any element (the download button's
 * row, a view toggle, ...) that should disappear for the duration of the
 * capture without being excluded structurally from the padded card element.
 * Attach it to as many elements as needed - `ref={hideOnExport}`.
 *
 * `brandRef` is meant for a hidden "SportsSimulate.com" element inside the
 * captured content: it's only made visible for the duration of the capture,
 * so the branding shows up in the exported PNG without cluttering the page.
 */
export function useExportableCard(filename: string) {
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLSpanElement>(null);
  const hiddenElements = useRef<Set<HTMLElement>>(new Set());

  const hideOnExport = useCallback((el: HTMLElement | null) => {
    if (el) hiddenElements.current.add(el);
  }, []);

  async function handleDownload() {
    const content = contentRef.current;
    if (!content || downloading) return;
    setDownloading(true);
    const brand = brandRef.current;
    const toHide = Array.from(hiddenElements.current);
    const previousDisplays = toHide.map((el) => el.style.display);
    // Cards that sit next to a taller sibling in a CSS grid (e.g. "Most
    // Likely CCG Matchups" beside "Conference Standings") are stretched by
    // the grid to match that sibling's height, leaving real empty space
    // inside the shorter card - genuine layout, not just a visual overflow.
    // Overriding align-self for the capture shrinks it back to its own
    // content's height; harmless on cards that aren't grid/flex items.
    const previousAlignSelf = content.style.alignSelf;
    try {
      toHide.forEach((el) => { el.style.display = 'none'; });
      if (brand) brand.style.display = 'inline';
      content.style.alignSelf = 'start';
      const restoreImages = await inlineImagesForExport(content);
      try {
        const backgroundColor = resolveEffectiveBackground(content);
        await downloadElementAsPng(content, filename, { backgroundColor });
      } finally {
        restoreImages();
      }
    } finally {
      toHide.forEach((el, i) => { el.style.display = previousDisplays[i]; });
      if (brand) brand.style.display = 'none';
      content.style.alignSelf = previousAlignSelf;
      setDownloading(false);
    }
  }

  return { contentRef, hideOnExport, brandRef, downloading, handleDownload };
}
