/**
 * PhotoCard / PhotoViewer may still call this on <img> error.
 * Never return Unsplash, Picsum, or any other remote URL.
 * Empty src can retrigger onError, so this is a 1×1 transparent GIF.
 */
export function picsumFallback(_seed: string, _width: number, _height: number): string {
  return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
}
