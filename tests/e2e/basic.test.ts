import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

describe("Build", () => {
  it("compiles TypeScript without errors", () => {
    const root = path.resolve(__dirname, "../..");
    expect(() => {
      execSync("npx tsc --noEmit", { cwd: root, stdio: "pipe" });
    }).not.toThrow();
  });
});
