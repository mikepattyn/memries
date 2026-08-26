import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testAlbum } from "../test/fixtures";

const useAlbum = vi.fn();

vi.mock("../hooks/useAlbums", () => ({
  useAlbum: (...args: unknown[]) => useAlbum(...args),
}));

import { AlbumPage } from "./AlbumPage";

describe("AlbumPage", () => {
  beforeEach(() => {
    useAlbum.mockReset();
  });

  it("uses the Album name as the page heading", () => {
    useAlbum.mockReturnValue({
      isPending: false,
      isError: false,
      isSuccess: true,
      data: { album: testAlbum({ name: "Summer", photoCount: 0, photoIds: [] }), photos: [] },
      refetch: vi.fn(),
    });
    render(<AlbumPage albumId="a1" onBack={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: "Summer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to albums" })).toBeTruthy();
  });

  it("announces a failed Album load", () => {
    useAlbum.mockReturnValue({
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      refetch: vi.fn(),
    });
    render(<AlbumPage albumId="a1" onBack={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("We could not open this album");
  });
});
