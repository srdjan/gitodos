#!/usr/bin/env -S deno run --allow-read --allow-run

// Ensures the issues HTML exists, then opens it cross-platform

const htmlPath = ".git-bin/issues.html";

async function ensureHtml() {
  try {
    await Deno.lstat(htmlPath);
    return;
  } catch {
    // Generate if missing
    const p = new Deno.Command("deno", { args: ["run", "--allow-read", "--allow-write", ".git-bin/issues-web.ts"], stdout: "null", stderr: "inherit" });
    const { code } = await p.output();
    if (code !== 0) throw new Error("Failed to generate issues.html");
  }
}

async function openFile(path: string) {
  const os = Deno.build.os;
  if (os === "darwin") {
    return await new Deno.Command("open", { args: [path] }).output();
  } else if (os === "linux") {
    return await new Deno.Command("xdg-open", { args: [path] }).output();
  } else if (os === "windows") {
    // Use rundll32 to open via default handler
    return await new Deno.Command("rundll32", { args: ["url.dll,FileProtocolHandler", path] }).output();
  } else {
    throw new Error(`Unsupported OS: ${os}`);
  }
}

await ensureHtml();
const { code } = await openFile(htmlPath);
if (code !== 0) {
  console.error("Failed to open", htmlPath);
  Deno.exit(code);
}

