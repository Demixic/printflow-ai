"use server";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readAuthConfig } from "./config";
import { hashPassword, verifyPassword } from "./password";
import { createAttemptLimiter } from "./rate-limit";
import { endSession, startSession } from "./session";

export type SignInState = { status: "idle" } | { status: "error"; message: string };

const limiter = createAttemptLimiter();
const INVALID = "Incorrect username or password.";

// Verified against when the username is wrong, so response time doesn't reveal valid usernames.
let decoyHash: Promise<string> | undefined;
const decoy = () => (decoyHash ??= hashPassword(randomBytes(24).toString("base64url")));

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function clientKey(username: string): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${forwarded || "unknown"}|${username.toLowerCase()}`;
}

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const username = String(formData.get("username") ?? "").trim().slice(0, 100);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!username || !password) return { status: "error", message: "Enter your username and password." };

  const { secret, editor } = readAuthConfig();
  if (!secret || !editor) return { status: "error", message: "Editor sign-in isn't configured on this deployment." };

  const key = await clientKey(username);
  const wait = limiter.retryAfterSeconds(key);
  if (wait > 0) {
    return { status: "error", message: `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} min.` };
  }

  const userMatches = sameText(username, editor.username);
  const passwordMatches = await verifyPassword(password, userMatches ? editor.passwordHash : await decoy());
  if (!userMatches || !passwordMatches) {
    limiter.recordFailure(key);
    return { status: "error", message: INVALID };
  }

  limiter.reset(key);
  await startSession("editor", editor.username);
  redirect("/");
}

export async function startDemoAction(): Promise<SignInState> {
  const { secret, demoViewerEnabled } = readAuthConfig();
  if (!secret || !demoViewerEnabled) return { status: "error", message: "The read-only demo isn't available." };
  await startSession("viewer", "demo");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
