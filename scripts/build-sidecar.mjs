#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "..");
const SIDECAR = path.join(ROOT, "sidecar");
const PLATFORM = `${process.platform}-${process.arch}`;
const OUT_DIR = path.join(ROOT, "dist-sidecar", PLATFORM);
const VENV = path.join(SIDECAR, ".venv-build");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("error", reject);
    p.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
  });
}

async function main() {
  if (!existsSync(VENV)) {
    await run("python3", ["-m", "venv", VENV], { cwd: SIDECAR });
  }
  const py = process.platform === "win32"
    ? path.join(VENV, "Scripts", "python.exe")
    : path.join(VENV, "bin", "python");
  await run(py, ["-m", "pip", "install", "--upgrade", "pip", "wheel"]);
  await run(py, ["-m", "pip", "install", "-e", ".[whisper,parakeet]"], { cwd: SIDECAR });
  await run(py, ["-m", "pip", "install", "pyinstaller>=6.0"]);

  mkdirSync(OUT_DIR, { recursive: true });
  await run(py, [
    "-m", "PyInstaller",
    "ultimate_asr.spec",
    "--distpath", OUT_DIR,
    "--workpath", path.join(SIDECAR, "build"),
    "--noconfirm",
  ], { cwd: SIDECAR });

  console.log(`✔ Sidecar built at ${OUT_DIR}/ultimate_asr/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
