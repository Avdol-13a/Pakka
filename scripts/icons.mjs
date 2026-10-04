import fs from "node:fs";
import zlib from "node:zlib";
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) {
    c ^= x;
    for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const name = Buffer.from(type),
    len = Buffer.alloc(4),
    end = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  end.writeUInt32BE(crc(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, end]);
}
for (const size of [192, 512]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = x / size,
        b = y / size;
      const stem = a > 0.28 && a < 0.37 && b > 0.25 && b < 0.75;
      const outer = ((a - 0.46) / 0.22) ** 2 + ((b - 0.405) / 0.16) ** 2 < 1;
      const inner = ((a - 0.46) / 0.12) ** 2 + ((b - 0.405) / 0.075) ** 2 < 1;
      const p = stem || (outer && !inner && a > 0.33);
      const check =
        (Math.abs(b - (a - 0.03)) < 0.023 && a > 0.58 && a < 0.67) ||
        (Math.abs(b - (-a + 1.3)) < 0.024 && a >= 0.65 && a < 0.81);
      const rgb = check ? [225, 179, 101] : p ? [250, 244, 232] : [23, 77, 56];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw.set([...rgb, 255], i);
    }
  }
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(size);
  ih.writeUInt32BE(size, 4);
  ih[8] = 8;
  ih[9] = 6;
  fs.writeFileSync(
    `public/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ih),
      chunk("IDAT", zlib.deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
