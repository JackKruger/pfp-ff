import { describe, expect, it } from "vitest";
import { validateDesktopServerConfig } from "../src/serverConfig.js";

function goodConfig() {
  return {
    command: ["pnpm", "--filter", "@mydrunner/server", "run", "start"],
    cwd: "../mydrunner",
    healthCheckUrl: "http://localhost:2567/health",
    port: 2567,
  };
}

describe("validateDesktopServerConfig", () => {
  it("accepts the shape real manifests declare", () => {
    expect(validateDesktopServerConfig(goodConfig())).toEqual([]);
  });

  it("accepts 127.0.0.1 and [::1] health check hosts", () => {
    expect(
      validateDesktopServerConfig({ ...goodConfig(), healthCheckUrl: "http://127.0.0.1:2567/h" }),
    ).toEqual([]);
    expect(
      validateDesktopServerConfig({ ...goodConfig(), healthCheckUrl: "http://[::1]:2567/h" }),
    ).toEqual([]);
  });

  it("rejects non-objects", () => {
    expect(validateDesktopServerConfig(null)).not.toEqual([]);
    expect(validateDesktopServerConfig("rm -rf /")).not.toEqual([]);
  });

  it("rejects an empty or non-string command argv", () => {
    expect(validateDesktopServerConfig({ ...goodConfig(), command: [] })).not.toEqual([]);
    expect(validateDesktopServerConfig({ ...goodConfig(), command: ["node", 5] })).not.toEqual([]);
    expect(validateDesktopServerConfig({ ...goodConfig(), command: [""] })).not.toEqual([]);
  });

  it("rejects privileged and out-of-range ports (killWhateverIsOnPort guard)", () => {
    expect(validateDesktopServerConfig({ ...goodConfig(), port: 22 })).not.toEqual([]);
    expect(validateDesktopServerConfig({ ...goodConfig(), port: 0 })).not.toEqual([]);
    expect(validateDesktopServerConfig({ ...goodConfig(), port: 70000 })).not.toEqual([]);
    expect(validateDesktopServerConfig({ ...goodConfig(), port: 2567.5 })).not.toEqual([]);
  });

  it("rejects non-loopback and non-http health check URLs", () => {
    expect(
      validateDesktopServerConfig({ ...goodConfig(), healthCheckUrl: "http://example.com/h" }),
    ).not.toEqual([]);
    expect(
      validateDesktopServerConfig({ ...goodConfig(), healthCheckUrl: "https://localhost:2567/h" }),
    ).not.toEqual([]);
    expect(
      validateDesktopServerConfig({ ...goodConfig(), healthCheckUrl: "not a url" }),
    ).not.toEqual([]);
  });

  it("rejects a health check port that differs from config.port", () => {
    expect(
      validateDesktopServerConfig({ ...goodConfig(), healthCheckUrl: "http://localhost:9999/h" }),
    ).not.toEqual([]);
  });
});
