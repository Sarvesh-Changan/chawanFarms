import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VideoUploader } from "../../src/components/rewards/VideoUploader";

describe("VideoUploader accessibility and interactions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has no axe violations in its initial state", async () => {
    const { container } = render(
      <VideoUploader acceptedFormats={["mp4", "mov", "webm"]} maxBytes={100_000_000} maxDurationSeconds={90} formattedMaxBytes="100 MB" />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it("keeps consent checkboxes behaving as expected (ownership required, publish optional)", () => {
    render(
      <VideoUploader acceptedFormats={["mp4", "mov", "webm"]} maxBytes={100_000_000} maxDurationSeconds={90} formattedMaxBytes="100 MB" />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(2);

    const ownershipCheckbox = checkboxes[0] as HTMLInputElement;
    const publishCheckbox = checkboxes[1] as HTMLInputElement;

    expect(ownershipCheckbox.required).toBe(true);
    expect(ownershipCheckbox.checked).toBe(false);

    expect(publishCheckbox.required).toBe(false);
    expect(publishCheckbox.checked).toBe(false);

    fireEvent.click(ownershipCheckbox);
    expect(ownershipCheckbox.checked).toBe(true);

    fireEvent.click(publishCheckbox);
    expect(publishCheckbox.checked).toBe(true);
  });

  it("displays clear message and Resume/Cancel buttons on UPLOAD_IN_PROGRESS with zero axe violations", async () => {
    vi.spyOn(global, "fetch").mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          code: "UPLOAD_IN_PROGRESS",
          message: "You already have an upload in progress. Resume or cancel it.",
          submissionId: "sub-12345",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    });

    const { container } = render(
      <VideoUploader acceptedFormats={["mp4", "mov", "webm"]} maxBytes={100_000_000} maxDurationSeconds={90} formattedMaxBytes="100 MB" />,
    );

    // Provide a file and visit date
    const file = new File(["dummy content"], "test.mp4", { type: "video/mp4" });
    const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const dateInput = screen.getByLabelText(/Visit date/i);
    fireEvent.change(dateInput, { target: { value: "01/10/2026" } });

    const ownershipCheckbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(ownershipCheckbox);

    const submitBtn = screen.getByRole("button", { name: /Submit video/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("You already have an upload in progress. Resume or cancel it.")).toBeDefined();
    });

    expect(screen.getByRole("button", { name: /Resume upload/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Cancel previous upload/i })).toBeDefined();

    expect((await axe(container)).violations).toEqual([]);
  });

  it("displays email verification message and link on EMAIL_NOT_VERIFIED", async () => {
    vi.spyOn(global, "fetch").mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email first.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    });

    const { container } = render(
      <VideoUploader acceptedFormats={["mp4", "mov", "webm"]} maxBytes={100_000_000} maxDurationSeconds={90} formattedMaxBytes="100 MB" />,
    );

    const file = new File(["dummy content"], "test.mp4", { type: "video/mp4" });
    const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const dateInput = screen.getByLabelText(/Visit date/i);
    fireEvent.change(dateInput, { target: { value: "01/10/2026" } });

    const ownershipCheckbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(ownershipCheckbox);

    const submitBtn = screen.getByRole("button", { name: /Submit video/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Please verify your email first.")).toBeDefined();
    });

    expect(screen.getByRole("link", { name: /Go to your account to verify your email/i })).toBeDefined();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("displays reset time on DAILY_LIMIT_EXCEEDED", async () => {
    vi.spyOn(global, "fetch").mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          code: "DAILY_LIMIT_EXCEEDED",
          message: "You have reached today's upload limit; you can upload again after 4:30 PM IST.",
          retryAfter: 3600,
        }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "3600" } }
      );
    });

    const { container } = render(
      <VideoUploader acceptedFormats={["mp4", "mov", "webm"]} maxBytes={100_000_000} maxDurationSeconds={90} formattedMaxBytes="100 MB" />,
    );

    const file = new File(["dummy content"], "test.mp4", { type: "video/mp4" });
    const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const dateInput = screen.getByLabelText(/Visit date/i);
    fireEvent.change(dateInput, { target: { value: "01/10/2026" } });

    const ownershipCheckbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(ownershipCheckbox);

    const submitBtn = screen.getByRole("button", { name: /Submit video/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/You have reached today's upload limit/i)).toBeDefined();
    });
    expect((await axe(container)).violations).toEqual([]);
  });

  it("displays clear message on REWARDS_DISABLED", async () => {
    vi.spyOn(global, "fetch").mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          code: "REWARDS_DISABLED",
          message: "Video reward submissions are currently paused. Please check back later.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    });

    const { container } = render(
      <VideoUploader acceptedFormats={["mp4", "mov", "webm"]} maxBytes={100_000_000} maxDurationSeconds={90} formattedMaxBytes="100 MB" />,
    );

    const file = new File(["dummy content"], "test.mp4", { type: "video/mp4" });
    const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const dateInput = screen.getByLabelText(/Visit date/i);
    fireEvent.change(dateInput, { target: { value: "01/10/2026" } });

    const ownershipCheckbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(ownershipCheckbox);

    const submitBtn = screen.getByRole("button", { name: /Submit video/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Video reward submissions are currently paused. Please check back later.")).toBeDefined();
    });
    expect((await axe(container)).violations).toEqual([]);
  });
});
