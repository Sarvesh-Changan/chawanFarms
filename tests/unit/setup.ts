import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "mock-auth-secret-for-testing-purposes-32-chars";

afterEach(() => {
  cleanup();
});
