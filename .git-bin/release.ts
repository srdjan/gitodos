#!/usr/bin/env -S deno run -A

// Build cross-platform binaries into dist/
// - git-issues: scanner (requires read/write/run)
// - issues-web: HTML generator (requires read/write)

type Target =
  | "x86_64-apple-darwin"
  | "aarch64-apple-darwin"
  | "x86_64-unknown-linux-gnu"
  | "aarch64-unknown-linux-gnu"
  | "x86_64-pc-windows-msvc";

const targets: Target[] = [
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-pc-windows-msvc",
];

const ensureDir = async (p: string) => {
  try { await Deno.mkdir(p, { recursive: true }); } catch (_) { /* ignore */ }
};

const compile = async (args: string[]) => {
  const proc = new Deno.Command("deno", { args: ["compile", ...args], stdout: "piped", stderr: "inherit" });
  const out = await proc.output();
  if (out.code !== 0) throw new Error(`deno compile failed: ${new TextDecoder().decode(out.stdout)}`);
};

const main = async () => {
  await ensureDir("dist");
  console.log("Building release binaries → dist/");

  for (const t of targets) {
    const ext = t.includes("windows") ? ".exe" : "";
    const outIssues = `dist/git-issues-${t}${ext}`;
    const outWeb = `dist/issues-web-${t}${ext}`;

    console.log(`• git-issues (${t})`);
    await compile([
      "--target", t,
      "--allow-read", "--allow-write", "--allow-run",
      "--output", outIssues,
      ".git-bin/git-issues.ts",
    ]);

    console.log(`• issues-web (${t})`);
    await compile([
      "--target", t,
      "--allow-read", "--allow-write",
      "--output", outWeb,
      ".git-bin/issues-web.ts",
    ]);
  }

  console.log("Done. Binaries are in dist/.");
};

if (import.meta.main) {
  await main();
}

