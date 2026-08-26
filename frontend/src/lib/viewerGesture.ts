export const VIEWER_SWIPE_PX = 56;
export const VIEWER_DISMISS_PX = 80;

export type ViewerGesture = "next" | "prev" | "dismiss" | "snap";

export function resolveViewerGesture(dx: number, dy: number): ViewerGesture {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay >= ax && dy >= VIEWER_DISMISS_PX) return "dismiss";
  if (ax > ay && ax >= VIEWER_SWIPE_PX) return dx > 0 ? "prev" : "next";
  return "snap";
}
