import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsEditor } from "@/components/admin/cms/SettingsEditor";
import type { CmsSettings } from "@/server/services/cms/settings";

const { saveSettings, refresh } = vi.hoisted(() => ({ saveSettings: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/server/actions/cms", () => ({ saveCmsSettingsAction: saveSettings, changeStaffPasswordAction: vi.fn() }));
vi.mock("@/components/media/LocalImageUploader", () => ({
  LocalImageUploader: ({ label, onChange, onPendingChange }: { label: string; onChange: (id: string) => void; onPendingChange?: (pending: boolean) => void }) => <><button type="button" onClick={() => onChange(mediaIdForLabel(label))}>Select {label}</button><button type="button" onClick={() => onPendingChange?.(true)}>Start {label} upload</button><button type="button" onClick={() => onPendingChange?.(false)}>Finish {label} upload</button></>,
}));

const mediaIdByLabel: Record<string, string> = {
  "Owner portrait": "11111111-1111-4111-8111-111111111111",
  "Home hero image": "22222222-2222-4222-8222-222222222222",
  "Hero inset image 1 (optional, top-right)": "33333333-3333-4333-8333-333333333333",
  "Hero inset image 2 (optional, bottom-left)": "44444444-4444-4444-8444-444444444444",
};
function mediaIdForLabel(label: string) {
  return Object.entries(mediaIdByLabel).find(([key]) => key === label)?.[1] ?? "11111111-1111-4111-8111-111111111111";
}

const initial = {
  businessTagline: "Agri-Tourism & Home Stay", businessName: { en: "Chawan Farms" }, businessEmail: "",
  phones: [], whatsappNumber: "", whatsappDefaultMessage: { en: "" }, address: { en: "" },
  ownerDisplay: false, ownerMediaId: null, ownerName: "", ownerCaption: "", heroHeadline: "", heroSubhead: "",
  heroPrimaryCta: "", heroSecondaryCta: "", heroMediaId: null, heroInset1MediaId: null, heroInset2MediaId: null,
  closingHeadline: "", instagramUrl: "", facebookUrl: "", youtubeUrl: "",
} as CmsSettings;

describe("SettingsEditor hero images", () => {
  it("resets fields from settings returned by a router refresh", async () => {
    const { rerender } = render(<SettingsEditor initial={initial} canWrite cloudName="test-cloud" />);
    const updated = { ...initial, heroHeadline: "Saved farm headline", heroSubhead: "Saved subhead" };
    rerender(<SettingsEditor initial={updated} canWrite cloudName="test-cloud" />);

    await waitFor(() => expect(screen.getByLabelText("Headline")).toHaveValue("Saved farm headline"));
    expect(screen.getByLabelText("Subhead")).toHaveValue("Saved subhead");
  });

  it("prevents saving until image verification has finished", () => {
    render(<SettingsEditor initial={initial} canWrite cloudName="test-cloud" />);
    const saveHero = screen.getByRole("button", { name: "Save hero content" });
    fireEvent.click(screen.getByRole("button", { name: "Start Home hero image upload" }));
    expect(saveHero).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Finish Home hero image upload" }));
    expect(saveHero).toBeEnabled();
  });

  it("shows a visible validation message instead of silently skipping the save action", async () => {
    render(<SettingsEditor initial={initial} canWrite cloudName="test-cloud" />);
    fireEvent.click(screen.getByRole("button", { name: "Add phone" }));
    fireEvent.click(screen.getByRole("button", { name: "Save hero content" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Too small: expected string to have >=3 characters");
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("submits the owner, hero, and inset media ids and refreshes after saving", async () => {
    saveSettings.mockResolvedValue({ ok: true, data: { id: "saved" } });
    render(<SettingsEditor initial={initial} canWrite cloudName="test-cloud" />);

    fireEvent.click(screen.getByRole("button", { name: "Select Owner portrait" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Display section on Home page" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Home hero image" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Hero inset image 1 (optional, top-right)" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Hero inset image 2 (optional, bottom-left)" }));
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "Saved hero headline" } });
    fireEvent.change(screen.getByLabelText("Subhead"), { target: { value: "Saved hero description" } });
    fireEvent.click(screen.getByRole("button", { name: "Save hero content" }));

    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    expect(saveSettings.mock.calls.at(-1)?.[0]).toMatchObject({
      ownerDisplay: true,
      heroHeadline: "Saved hero headline",
      heroSubhead: "Saved hero description",
      ownerMediaId: mediaIdByLabel["Owner portrait"],
      heroMediaId: mediaIdByLabel["Home hero image"],
      heroInset1MediaId: mediaIdByLabel["Hero inset image 1 (optional, top-right)"],
      heroInset2MediaId: mediaIdByLabel["Hero inset image 2 (optional, bottom-left)"],
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
