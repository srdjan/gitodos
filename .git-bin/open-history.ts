#!/usr/bin/env -S deno run --allow-read --allow-run

// Ensures the history HTML exists, then opens it cross-platform

const htmlPath = ".git-bin/history.html";

async function ensureHtml() {
  try {
    await Deno.lstat(htmlPath);
    return;
  } catch {
    const p = new Deno.Command("deno", { args: ["run", "-A", ".git-bin/history-web.ts"], stdout: "null", stderr: "inherit" });
    const { code } = await p.output();
    if (code !== 0) throw new Error("Failed to generate history.html");
  }
}

async function openFile(path: string) {
  const os = Deno.build.os;
  if (os === "darwin") return await new Deno.Command("open", { args: [path] }).output();
  if (os === "linux") return await new Deno.Command("xdg-open", { args: [path] }).output();
  if (os === "windows") return await new Deno.Command("rundll32", { args: ["url.dll,FileProtocolHandler", path] }).output();
  throw new Error(`Unsupported OS: ${os}`);
}

await ensureHtml();
const { code } = await openFile(htmlPath);
if (code !== 0) {
  console.error("Failed to open", htmlPath);
  Deno.exit(code);
}

