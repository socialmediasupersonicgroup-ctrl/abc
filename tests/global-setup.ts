import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/** Creates a fresh, isolated SQLite database for the test run by applying the real migrations. */
export default function setup() {
  for (const suffix of ["", "-journal"]) rmSync(path.join(__dirname, "..", "prisma", `test.db${suffix}`), { force: true });
  execSync("npx prisma migrate deploy", { stdio: "ignore", env: { ...process.env, DATABASE_URL: "file:./test.db" } });
}
