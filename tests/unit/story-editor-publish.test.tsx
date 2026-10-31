import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, refresh, saveStoryAction, setStoryStatusAction } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  saveStoryAction: vi.fn(),
  setStoryStatusAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/server/actions/cms-stories", () => ({
  deleteStoryAction: vi.fn(),
  restoreStoryAction: vi.fn(),
  saveStoryAction,
  setStoryStatusAction,
}));
vi.mock("@/server/actions/cms-content", () => ({ createCmsPreviewAction: vi.fn() }));
vi.mock("@/components/admin/RichTextEditor", () => ({ RichTextEditor: () => null }));
vi.mock("@/components/media/LocalImageUploader", () => ({
  LocalImageUploader: ({ label, onChange }: { label: string; onChange: (id: string) => void }) => label === "Cover image"
    ? <button type="button" onClick={() => onChange("00000000-0000-4000-8000-000000000002")}>Choose replacement cover</button>
    : null,
  LocalImageBatchUploader: () => null,
}));
vi.mock("@/components/media/LocalVideoUploader", () => ({ LocalVideoUploader: () => null }));

import { StoryEditor } from "@/components/admin/stories/StoryEditor";

describe("StoryEditor publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveStoryAction.mockResolvedValue({ ok: true, data: { id: "story-id" } });
    setStoryStatusAction.mockResolvedValue({ ok: true, data: { id: "story-id" } });
  });

  it("saves changed story fields and cover media before publishing", async () => {
    render(<StoryEditor initial={{
      id: "story-id",
      kind: "STORY",
      title: { en: "Old title" },
      summary: { en: "Old summary" },
      body: { en: "" },
      coverMediaId: "00000000-0000-4000-8000-000000000001",
      photoMediaIds: [],
      videoMediaId: "",
      slug: "test-story",
      featured: false,
      status: "DRAFT",
      media: [],
    }} cloudName="demo-cloud" />);

    fireEvent.change(screen.getByLabelText("Title (English)"), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose replacement cover" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(saveStoryAction).toHaveBeenCalledTimes(1));
    const savedStory = saveStoryAction.mock.calls[0]?.[0];
    expect(savedStory).toMatchObject({
      id: "story-id",
      title: { en: "Updated title" },
      coverMediaId: "00000000-0000-4000-8000-000000000002",
    });
    await waitFor(() => expect(setStoryStatusAction).toHaveBeenCalledWith({
      id: "story-id",
      status: "PUBLISHED",
      publishAt: null,
    }));
    expect(push).toHaveBeenCalledWith("/admin/stories/");
    expect(refresh).toHaveBeenCalled();
  });

  it("moves an edited published story to draft when Save draft is clicked", async () => {
    render(<StoryEditor initial={{
      id: "story-id",
      kind: "STORY",
      title: { en: "Published title" },
      summary: { en: "Published summary" },
      body: { en: "" },
      coverMediaId: "00000000-0000-4000-8000-000000000001",
      photoMediaIds: [],
      videoMediaId: "",
      slug: "test-story",
      featured: false,
      status: "PUBLISHED",
      media: [],
    }} cloudName="demo-cloud" />);

    fireEvent.change(screen.getByLabelText("Title (English)"), { target: { value: "Draft title" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose replacement cover" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(saveStoryAction).toHaveBeenCalledTimes(1));
    expect(saveStoryAction.mock.calls[0]?.[0]).toMatchObject({
      title: { en: "Draft title" },
      coverMediaId: "00000000-0000-4000-8000-000000000002",
    });
    await waitFor(() => expect(setStoryStatusAction).toHaveBeenCalledWith({
      id: "story-id",
      status: "DRAFT",
      publishAt: null,
    }));
    expect(saveStoryAction.mock.invocationCallOrder[0]).toBeLessThan(setStoryStatusAction.mock.invocationCallOrder[0] ?? Infinity);
  });
});
