import { describe, expect, it } from 'vitest';
import { resolveViewerGesture, VIEWER_DISMISS_PX, VIEWER_SWIPE_PX } from './viewerGesture';

describe('resolveViewerGesture', () => {
  it('advances on a left swipe past the threshold', () => {
    expect(resolveViewerGesture(-(VIEWER_SWIPE_PX + 1), 0)).toBe('next');
  });

  it('goes back on a right swipe past the threshold', () => {
    expect(resolveViewerGesture(VIEWER_SWIPE_PX, 4)).toBe('prev');
  });

  it('dismisses on a downward drag past the threshold', () => {
    expect(resolveViewerGesture(10, VIEWER_DISMISS_PX)).toBe('dismiss');
  });

  it('snaps back on a short drag', () => {
    expect(resolveViewerGesture(-20, 8)).toBe('snap');
    expect(resolveViewerGesture(4, 40)).toBe('snap');
  });

  it('prefers dismiss when the drag is mostly downward', () => {
    expect(resolveViewerGesture(30, 100)).toBe('dismiss');
  });
});
