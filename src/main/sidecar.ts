import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";

export interface SidecarOpts {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export class Sidecar extends EventEmitter {
  private proc?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private inflight = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  constructor(private opts: SidecarOpts) {
    super();
  }

  async start(): Promise<void> {
    this.proc = spawn(this.opts.command, this.opts.args, {
      env: this.opts.env,
      cwd: this.opts.cwd,
    });
    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id != null && this.inflight.has(msg.id)) {
          const { resolve, reject } = this.inflight.get(msg.id)!;
          this.inflight.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        } else if (msg.method) {
          this.emit("notify", msg.method, msg.params);
        }
      } catch (e) {
        this.emit("error", e);
      }
    });
    this.proc.stderr.on("data", (b) => this.emit("stderr", b.toString()));
    this.proc.on("exit", (code) => this.emit("exit", code));
  }

  call<T = unknown>(method: string, params: object = {}, timeoutMs = 30_000): Promise<T> {
    if (!this.proc) throw new Error("sidecar not started");
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.inflight.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);
      this.inflight.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v as T); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.proc!.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    try { this.proc.stdin.end(); } catch {}
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => { this.proc?.kill("SIGKILL"); resolve(); }, 2_000);
      this.proc!.once("exit", () => { clearTimeout(t); resolve(); });
    });
    this.proc = undefined;
  }
}
