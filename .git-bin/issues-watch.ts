#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

// Simple watch wrapper: on restart (via --watch), regenerate snapshots and HTML

const run = async (cmd: string[], quiet = false) => {
  const p = new Deno.Command(cmd[0], { args: cmd.slice(1), stdout: quiet ? "null" : "inherit", stderr: "inherit" });
  const { code } = await p.output();
  if (code !== 0) throw new Error(`Command failed: ${cmd.join(" ")}`);
};

try {
  await run(["deno", "run", "--allow-read", "--allow-write", "--allow-run", ".git-bin/git-issues.ts", "--out", ".git-bin/.issues"], true);
  await run(["deno", "run", "--allow-read", "--allow-write", "--allow-run", ".git-bin/git-issues.ts", "--path", "src", "--out", ".git-bin/.bugs"], true);
  await run(["deno", "run", "--allow-read", "--allow-write", ".git-bin/issues-web.ts"], true);
  console.log("Refreshed inline issues and dashboard (.git-bin/issues.html)");
} catch (e) {
  console.error("issues:watch error:", e?.message ?? e);
  // Do not throw to keep watch alive across transient failures
}
