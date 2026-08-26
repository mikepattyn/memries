import { describe, expect, it } from "vitest";
import {
  canRetryIndex,
  isIndexReady,
  shouldAutoStart,
  shouldInvalidatePhotos,
  shouldPoll,
  type IndexStatus,
} from "./indexStatus";

function status(phase: IndexStatus["status"]): IndexStatus {
  return {
    status: phase,
    prefix: "admin@example.com",
    discovered: 0,
    processed: 0,
    indexed: 0,
    skipped: 0,
    failed: 0,
  };
}

describe("index status decisions", () => {
  it("auto-starts only a never-run import", () => {
    expect(shouldAutoStart(status("not_started"))).toBe(true);
    expect(shouldAutoStart(status("complete"))).toBe(false);
    expect(shouldAutoStart(status("failed"))).toBe(false);
  });

  it("polls only while queued or running", () => {
    expect(shouldPoll(status("queued"))).toBe(true);
    expect(shouldPoll(status("running"))).toBe(true);
    expect(shouldPoll(status("complete"))).toBe(false);
    expect(shouldPoll(status("failed"))).toBe(false);
  });

  it("treats complete and complete_with_errors as ready for photos", () => {
    expect(isIndexReady(status("complete"))).toBe(true);
    expect(isIndexReady(status("complete_with_errors"))).toBe(true);
    expect(isIndexReady(status("running"))).toBe(false);
  });

  it("allows retry only after failure", () => {
    expect(canRetryIndex(status("failed"))).toBe(true);
    expect(canRetryIndex(status("complete"))).toBe(false);
  });

  it("invalidates photos when a poll finishes", () => {
    expect(shouldInvalidatePhotos(status("running"), status("complete"))).toBe(true);
    expect(shouldInvalidatePhotos(undefined, status("complete"))).toBe(false);
    expect(shouldInvalidatePhotos(status("complete"), status("complete"))).toBe(false);
  });
});
