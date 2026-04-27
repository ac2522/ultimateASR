// Generate tiny solid-color tray icons (idle = gray, recording = red).
// Pure-Node, no deps. PNG layout: signature + IHDR + IDAT (RGBA, deflate-compressed) + IEND.
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = (table[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([length, t, data, crc]);
}

function makePng(size, [r, g, b, a]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // color type RGBA
  ihdr.writeUInt8(0, 10); ihdr.writeUInt8(0, 11); ihdr.writeUInt8(0, 12);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync("assets", { recursive: true });
writeFileSync("assets/tray-idle.png", makePng(32, [120, 120, 120, 255]));      // gray
writeFileSync("assets/tray-recording.png", makePng(32, [220, 38, 38, 255]));   // red
console.log("Wrote tray icons.");
