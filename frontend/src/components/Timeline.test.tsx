import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timeline } from "./Timeline";

describe("Timeline", () => {
  it("uses a page heading and names the granularity group", () => {
    render(
      <Timeline
        photos={[]}
        granularity="month"
        onGranularityChange={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Your memries" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Group memories by" })).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("No memories here yet.");
  });
});
