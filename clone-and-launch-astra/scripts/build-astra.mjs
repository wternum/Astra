import { spawnSync } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], { cwd: path.join(root, "astra"), stdio: "inherit", shell: process.platform === "win32" });
if (result.status !== 0) process.exit(result.status || 1);
await mkdir(path.join(root, "public", "astra"), { recursive: true });
await copyFile(path.join(root, "astra", "dist", "index.html"), path.join(root, "public", "astra", "index.html"));
console.log("ASTRA build published to public/astra/index.html");
