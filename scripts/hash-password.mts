/**
 * Prints an scrypt hash for EDITOR_PASSWORD_HASH. The password is read without
 * echo (or from stdin when piped) and never written anywhere.
 *
 *   npm run auth:hash-password
 */
import { hashPassword } from "../src/server/auth/password";

async function readPassword(): Promise<string> {
  const { stdin, stderr } = process;
  if (!stdin.isTTY) {
    let data = "";
    for await (const chunk of stdin) data += chunk;
    return data.replace(/\r?\n$/, "");
  }
  stderr.write("Editor password (min 12 characters): ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let value = "";
    const onData = (key: string) => {
      if (key === "\u0003") process.exit(130); // Ctrl+C
      if (key === "\r" || key === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stderr.write("\n");
        resolve(value);
      } else if (key === "\u007f") value = value.slice(0, -1);
      else value += key;
    };
    stdin.on("data", onData);
  });
}

try {
  const hash = await hashPassword(await readPassword());
  console.log(hash);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
