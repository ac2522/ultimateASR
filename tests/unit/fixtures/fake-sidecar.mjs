import readline from "node:readline";
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (l) => {
  let m;
  try { m = JSON.parse(l); } catch { return; }
  if (m.method === "ping") {
    process.stdout.write(JSON.stringify({ id: m.id, result: "pong" }) + "\n");
  } else if (m.method === "emit") {
    // Emit a notification first, then a result.
    const { method, params } = m.params;
    process.stdout.write(JSON.stringify({ method, params }) + "\n");
    process.stdout.write(JSON.stringify({ id: m.id, result: null }) + "\n");
  } else {
    process.stdout.write(JSON.stringify({ id: m.id, error: { code: -32601, message: "not found" } }) + "\n");
  }
});
