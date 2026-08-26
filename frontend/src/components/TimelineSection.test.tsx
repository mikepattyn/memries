import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { testPhoto } from "../test/fixtures";
import { TimelineSection } from "./TimelineSection";

describe("TimelineSection", () => {
  it("exposes the Timeline Group as a labelled heading", () => {
    render(
      <TimelineSection
        group={{
          key: "2026-08",
          label: "August 2026",
          sublabel: "5 memories",
          photos: [testPhoto()],
        }}
        granularity="month"
        onOpen={() => {}}
        showHeading
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "August 2026" });
    expect(heading).toHaveAttribute("id", "period-2026-08");
    expect(heading.closest("section")).toHaveAttribute("aria-labelledby", "period-2026-08");
  });
});
