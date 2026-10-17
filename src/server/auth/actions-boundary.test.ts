/**
 * Calls the real server actions (the functions a browser POST reaches) with
 * mocked request cookies, proving authorization happens on the server before
 * any order service call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/lib/orders";
import { hashPassword } from "./password";
import { SESSION_TTL_SECONDS, createSessionToken } from "./token";

const SECRET = "boundary-test-secret-0123456789abcdef";
const jar = new Map<string, string>();
const headerValues = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(Object.fromEntries(headerValues)),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`REDIRECT:${to}`), { digest: `NEXT_REDIRECT;${to}` });
  },
}));

const order = { id: "o-1", orderNumber: "PF-10499" } as Order;
const service = {
  createOrder: vi.fn(async () => ({ ok: true as const, data: order })),
  updateOrder: vi.fn(async () => ({ ok: true as const, data: order })),
  advanceOrder: vi.fn(async () => ({ ok: true as const, data: order })),
  listOrders: vi.fn(async () => [] as Order[]),
};
vi.mock("@/server/orders", () => ({ getOrderService: () => service }));
vi.mock("@/server/brief/load", () => ({
  briefFor: vi.fn(async () => ({ ok: true, brief: { source: "rules" } })),
}));

const { createOrderAction, updateOrderAction, advanceOrderAction } = await import("@/server/orders/actions");
const { refreshBriefAction } = await import("@/server/brief/actions");
const { signInAction, startDemoAction, signOutAction } = await import("./actions");

const form = () => {
  const data = new FormData();
  for (const [k, v] of Object.entries({
    customer: "Lumen Labs",
    product: "Quarter-zips",
    method: "EMBROIDERY",
    quantity: "40",
    dueDate: "2099-01-01",
  })) {
    data.set(k, v);
  }
  return data;
};

const mutations = {
  create: () => createOrderAction({ status: "idle" }, form()),
  update: () => updateOrderAction("o-1", { status: "idle" }, form()),
  advance: () => advanceOrderAction("o-1"),
};
const writeCalls = () =>
  service.createOrder.mock.calls.length + service.updateOrder.mock.calls.length + service.advanceOrder.mock.calls.length;

const signIn = (role: "editor" | "viewer", secret = SECRET, now?: number) =>
  jar.set("printflow_session", createSessionToken(role, role === "editor" ? "jordan" : "demo", secret, now));

beforeEach(async () => {
  jar.clear();
  headerValues.clear();
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", SECRET);
  vi.stubEnv("EDITOR_USERNAME", "jordan");
  vi.stubEnv("EDITOR_PASSWORD_HASH", await editorHash);
  vi.stubEnv("DEMO_VIEWER_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

const editorHash = hashPassword("a-long-test-password");

describe.each(Object.entries(mutations))("%s order action", (_name, run) => {
  it("rejects requests with no session and never reaches the service", async () => {
    expect(await run()).toMatchObject({ status: "error", code: "unauthorized" });
    expect(writeCalls()).toBe(0);
  });

  it("rejects the read-only demo session", async () => {
    signIn("viewer");
    expect(await run()).toMatchObject({ status: "error", code: "forbidden" });
    expect(writeCalls()).toBe(0);
  });

  it("rejects a forged, expired or foreign session", async () => {
    for (const setup of [
      () => jar.set("printflow_session", "eyJ2IjoxLCJyb2xlIjoiZWRpdG9yIn0.forged"),
      () => signIn("editor", SECRET, Math.floor(Date.now() / 1000) - SESSION_TTL_SECONDS - 1),
      () => signIn("editor", "some-other-deployment-secret-0123456789"),
    ]) {
      jar.clear();
      setup();
      expect(await run()).toMatchObject({ status: "error", code: "unauthorized" });
    }
    expect(writeCalls()).toBe(0);
  });

  it("rejects every session when AUTH_SECRET is not configured", async () => {
    signIn("editor");
    vi.stubEnv("AUTH_SECRET", "");
    expect(await run()).toMatchObject({ status: "error", code: "unauthorized" });
    expect(writeCalls()).toBe(0);
  });

  it("allows an editor session", async () => {
    signIn("editor");
    expect(await run()).toMatchObject({ status: "success", order: { orderNumber: "PF-10499" } });
    expect(writeCalls()).toBe(1);
  });
});

describe("brief refresh action", () => {
  it("requires a session", async () => {
    expect(await refreshBriefAction()).toMatchObject({ ok: false });
    expect(service.listOrders).not.toHaveBeenCalled();
  });

  it("is available to the read-only demo", async () => {
    signIn("viewer");
    expect(await refreshBriefAction()).toMatchObject({ ok: true });
  });
});

describe("sign-in actions", () => {
  const credentials = (username: string, password: string) => {
    const data = new FormData();
    data.set("username", username);
    data.set("password", password);
    return data;
  };

  it("issues an editor session for correct credentials", async () => {
    await expect(signInAction({ status: "idle" }, credentials("jordan", "a-long-test-password"))).rejects.toThrow(
      "REDIRECT:/",
    );
    // The action set the session cookie, so a write now succeeds.
    expect(await createOrderAction({ status: "idle" }, form())).toMatchObject({ status: "success" });
  });

  it("rejects wrong credentials without revealing which part was wrong", async () => {
    for (const [user, pass] of [
      ["jordan", "wrong-password-123"],
      ["nobody", "a-long-test-password"],
    ]) {
      expect(await signInAction({ status: "idle" }, credentials(user, pass))).toEqual({
        status: "error",
        message: "Incorrect username or password.",
      });
    }
    expect(jar.size).toBe(0);
  });

  it("locks out repeated failures from the same client", async () => {
    headerValues.set("x-forwarded-for", "203.0.113.9");
    for (let i = 0; i < 5; i++) await signInAction({ status: "idle" }, credentials("jordan", `wrong-${i}-xxxxxxxx`));
    const locked = await signInAction({ status: "idle" }, credentials("jordan", "a-long-test-password"));
    expect(locked).toMatchObject({ status: "error", message: expect.stringMatching(/Too many failed attempts/) });
    expect(jar.size).toBe(0);
  });

  it("refuses editor sign-in when no credentials are configured", async () => {
    vi.stubEnv("EDITOR_PASSWORD_HASH", "");
    expect(await signInAction({ status: "idle" }, credentials("jordan", "a-long-test-password"))).toMatchObject({
      status: "error",
      message: "Editor sign-in isn't configured on this deployment.",
    });
  });

  it("starts a read-only demo session that cannot write", async () => {
    await expect(startDemoAction()).rejects.toThrow("REDIRECT:/");
    expect(await advanceOrderAction("o-1")).toMatchObject({ code: "forbidden" });
  });

  it("does not offer the demo when disabled", async () => {
    vi.stubEnv("DEMO_VIEWER_ENABLED", "false");
    expect(await startDemoAction()).toMatchObject({ status: "error" });
    expect(jar.size).toBe(0);
  });

  it("signs out by clearing the session", async () => {
    signIn("editor");
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/login");
    expect(await advanceOrderAction("o-1")).toMatchObject({ code: "unauthorized" });
  });
});
