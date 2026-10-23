import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { VideoUploader } from "../../src/components/rewards/VideoUploader";

describe("VideoUploader accessibility", () => {
  it("has no axe violations in its initial state", async () => {
    const { container } = render(
      <VideoUploader acceptedFormats={["mp4", "mov", "webm"]} maxBytes={100_000_000} maxDurationSeconds={90} formattedMaxBytes="100 MB" />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
