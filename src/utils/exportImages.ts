// A fully transparent 1x1 PNG, so an image that can't be fetched (e.g. no
// CORS support on its host - a browser restriction no client-side option
// can work around) just leaves a clean gap in the export instead of a
// broken-image icon, while keeping the element's layout box intact. PNG
// (not GIF) specifically - GIF transparency has been observed rendering as
// solid white through some DOM-to-image capture pipelines.
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==';

// SVGs are rasterized at this multiple of their on-screen box size, so the
// export stays crisp once the capture is scaled up further.
const SVG_RASTER_SCALE = 4;

async function fetchAsBlob(src: string): Promise<Blob> {
  const res = await fetch(src, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`);
  return res.blob();
}

// Some official conference sites (e.g. big12sports.com) serve certain
// assets without CORS headers, even though this same CDN already mirrors
// other assets from that exact host (verified: this project's own
// logo_light/logo_dark URLs for several teams already point at
// `<mirror>/<original-host>/<original-path>`). When a direct fetch fails,
// retrying through that mirror is a cheap, harmless attempt - if the asset
// isn't actually mirrored there, the retry just fails the same way and we
// fall back to the transparent pixel exactly as before.
const CORS_MIRROR_HOST = 'dbukjj6eu5tsf.cloudfront.net';

function mirroredUrl(original: string): string | null {
  try {
    const url = new URL(original);
    if (url.host === CORS_MIRROR_HOST) return null; // already the mirror
    return `https://${CORS_MIRROR_HOST}/${url.host}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Rasterize SVG source text to a PNG data: URL, fit ("contain") within
 * `boxWidth`x`boxHeight` and scaled up further for crispness, using the
 * browser's own native SVG rendering via a throwaway <img>/<canvas> pair.
 *
 * The box is a target to fit *within*, not the output size to stretch to:
 * `boxWidth`/`boxHeight` come from the on-screen <img>'s CSS box (e.g. a
 * fixed square logo slot), which is frequently a different aspect ratio
 * than the SVG's own intrinsic size (many conference logos are wide
 * rectangles shown via `object-contain` in a square box). Rasterizing to
 * the box's exact dimensions would silently stretch/squash the image;
 * this preserves the SVG's natural aspect ratio instead, matching what
 * `object-contain` already does on screen.
 *
 * Separately, some team/conference logo SVGs define their fills via an
 * internal <style> block with class selectors, which some DOM capture
 * libraries render completely blank even when the <img src> is already a
 * same-origin data: URI. Pre-rasterizing to a plain PNG ourselves sidesteps
 * that entirely - a canvas drawImage() of an SVG is just normal browser
 * rendering, nothing capture-library-specific about it.
 */
function rasterizeSvgToPng(svgText: string, boxWidth: number, boxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const naturalWidth = img.naturalWidth || boxWidth;
      const naturalHeight = img.naturalHeight || boxHeight;
      const fitScale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight) || 1;
      const drawWidth = naturalWidth * fitScale;
      const drawHeight = naturalHeight * fitScale;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(drawWidth * SVG_RASTER_SCALE));
      canvas.height = Math.max(1, Math.round(drawHeight * SVG_RASTER_SCALE));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2D canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to rasterize SVG'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  });
}

// Fetches `src`, converting it to a data: URI (rasterizing first if it's an
// SVG - see rasterizeSvgToPng). Throws if `src` can't be fetched at all
// (network error, no CORS headers, ...).
async function resolveInlineSrc(src: string, img: HTMLImageElement): Promise<string> {
  const blob = await fetchAsBlob(src);
  if (blob.type === 'image/svg+xml' || src.toLowerCase().split('?')[0].endsWith('.svg')) {
    const svgText = await blob.text();
    const width = img.clientWidth || img.naturalWidth || 32;
    const height = img.clientHeight || img.naturalHeight || 32;
    return rasterizeSvgToPng(svgText, width, height);
  }
  return blobToDataUrl(blob);
}

/**
 * Swap every <img> inside `root` to an inlined data: URI (SVGs rasterized
 * to PNG first) before a DOM-to-image capture, and return a function that
 * restores the original `src` attributes afterward.
 *
 * Some team/conference logos are hosted on domains that don't send CORS
 * headers at all - a browser-enforced restriction no client-side option can
 * work around, since it applies to any pixel-reading capture technique, not
 * just a particular library. Fetching and inlining each image ourselves
 * means the capture only ever sees data: URIs, which have no origin to
 * taint anything with; for images that fail outright, a retry through the
 * known CORS-friendly mirror (see `mirroredUrl`) recovers some of them, and
 * anything still unfetchable falls back to a transparent pixel instead of
 * silently rendering blank or as a broken-image icon.
 */
export async function inlineImagesForExport(root: HTMLElement): Promise<() => void> {
  const images = Array.from(root.querySelectorAll('img'));
  const originals = images.map((img) => img.getAttribute('src') ?? '');

  await Promise.all(
    images.map(async (img, i) => {
      const original = originals[i];
      if (!original || original.startsWith('data:')) return;
      try {
        img.src = await resolveInlineSrc(original, img);
        return;
      } catch {
        // fall through to the mirror retry below
      }
      const mirror = mirroredUrl(original);
      if (mirror) {
        try {
          img.src = await resolveInlineSrc(mirror, img);
          return;
        } catch {
          // fall through to the transparent-pixel fallback
        }
      }
      img.src = TRANSPARENT_PIXEL;
    }),
  );

  return () => {
    images.forEach((img, i) => {
      img.src = originals[i];
    });
  };
}

/**
 * Normalize any CSS color string to a plain `rgba()` string by actually
 * rasterizing it (fillRect + readback) on a throwaway 1x1 canvas, rather
 * than trusting `ctx.fillStyle`'s string serialization - modern browsers
 * preserve wide-gamut color functions (oklch, oklab, ...) when read back
 * off `fillStyle` instead of always converting to sRGB, so that round-trip
 * alone doesn't normalize anything. Reading the actual rasterized pixel
 * bytes back via `getImageData` always yields plain 0-255 RGB integers
 * regardless of what color space/function was used to specify the color.
 * Some DOM-to-image capture libraries' own color parsers don't recognize
 * newer CSS color functions (Tailwind v4's default palette uses oklch) and
 * silently fail to apply them - normalizing first sidesteps that entirely.
 */
export function normalizeColor(color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return color;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

function parseRgba(color: string): [number, number, number, number] {
  const match = color.match(/rgba?\(([^)]+)\)/);
  const [r, g, b, a = 1] = (match?.[1] ?? '255, 255, 255, 1').split(',').map(Number);
  return [r, g, b, a];
}

/**
 * Trigger a browser download of `blob` as `filename`, via a `blob:` object
 * URL rather than a `data:` URL. Mobile Safari (and Chrome/other browsers on
 * iOS, which are all required to use WebKit under the hood) don't reliably
 * honor the `download` attribute on an `<a>` pointed at a `data:` URI - it
 * often just navigates to display the image inline instead of saving it. A
 * `blob:` URL is well-supported for this across iOS WebKit versions.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Revoke on a delay rather than immediately after click() - some
    // browsers (notably iOS Safari/WebKit) resolve the download
    // asynchronously, and revoking too early can abort it.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

/**
 * Capture `content` (with its `<img>`s already inlined via
 * `inlineImagesForExport`) to a PNG and trigger a download, using
 * `modern-screenshot`'s `domToBlob` rather than `domToPng` specifically so
 * the download goes through `downloadBlob`'s `blob:` URL instead of a
 * `data:` URL - see `downloadBlob` for why that matters on iOS.
 *
 * `filename` is prefixed with the brand name here (rather than at each call
 * site) so every exported PNG is named consistently without every caller
 * having to remember to do it themselves.
 */
export async function downloadElementAsPng(
  content: HTMLElement,
  filename: string,
  options: { backgroundColor: string; scale?: number },
): Promise<void> {
  const { domToBlob } = await import('modern-screenshot');
  const blob = await domToBlob(content, { backgroundColor: options.backgroundColor, scale: options.scale ?? 2 });
  downloadBlob(blob, `sportssimulate-${filename}`);
}

/**
 * Walk from the document root down to `el` (inclusive), alpha-compositing
 * every ancestor's background color in painter's-algorithm order, and return
 * the resulting fully opaque color. `background-color` isn't inherited, so
 * an element with no background of its own (e.g. ZoomPane's pannable content
 * div) computes as fully transparent even though it visually sits over its
 * ancestors' backgrounds - and some of those ancestors (e.g. ZoomPane's own
 * outer element, which tints itself with a translucent bg-gray-50/50 /
 * bg-gray-900/30) are themselves only partially opaque, so simply returning
 * the nearest non-transparent one verbatim (its own partial alpha included)
 * doesn't match what's actually visible on screen underneath it.
 *
 * Used to find the right backdrop color to pre-fill an export canvas with,
 * instead of leaving it transparent (which makes any translucent/opacity-
 * modified fills in the captured content look washed out once the
 * alpha-blended pixels are viewed against anything other than that same
 * backdrop) or a wrong/partially-transparent color (which then blends
 * differently depending on whatever the downloaded PNG is later viewed
 * against).
 */
export function resolveEffectiveBackground(el: HTMLElement): string {
  const layers: HTMLElement[] = [];
  for (let current: HTMLElement | null = el; current; current = current.parentElement) {
    layers.push(current);
  }

  let [r, g, b] = [255, 255, 255];
  for (let i = layers.length - 1; i >= 0; i--) {
    const bg = getComputedStyle(layers[i]).backgroundColor;
    const isTransparent = bg === 'transparent' || /^rgba?\([^)]*,\s*0\s*\)$/.test(bg);
    if (isTransparent) continue;
    const [layerR, layerG, layerB, layerA] = parseRgba(normalizeColor(bg));
    r = layerR * layerA + r * (1 - layerA);
    g = layerG * layerA + g * (1 - layerA);
    b = layerB * layerA + b * (1 - layerA);
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
