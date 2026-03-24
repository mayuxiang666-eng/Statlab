import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { getPythonMLHealth, runCustomPythonCode } from "../analysis/pythonBridge";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe("pythonBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns health details when python service is reachable", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { ok: true, env: { healthy: true, message: "ok" } },
    });

    const res = await getPythonMLHealth();
    expect(res.ok).toBe(true);
    expect(res.env.healthy).toBe(true);
  });

  it("returns fallback health when python service is unreachable", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const res = await getPythonMLHealth();
    expect(res.ok).toBe(false);
    expect(res.env.healthy).toBe(false);
  });

  it("forwards stepTests in custom code execution payload", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await runCustomPythonCode("print('x')", [{ a: 1 }], ["assert True"], ["assert 'a' in df.columns"]);

    const [, payload] = mockedAxios.post.mock.calls[0];
    expect(payload.stepTests).toEqual(["assert 'a' in df.columns"]);
    expect(payload.tests).toEqual(["assert True"]);
  });

  it("throws readable error when python run-code fails", async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { detail: "dependency missing" } },
    });

    await expect(runCustomPythonCode("print(1)", [])).rejects.toThrow("Python ML service error: dependency missing");
  });
});


