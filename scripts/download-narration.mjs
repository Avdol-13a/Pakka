import fs from "node:fs";
const { url } = JSON.parse(
  fs.readFileSync(".cache/narration-download.json", "utf8"),
);
const res = await fetch(url);
if (!res.ok) throw Error("Narration download failed: " + res.status);
fs.mkdirSync("demo", { recursive: true });
fs.writeFileSync("demo/narration.mp3", Buffer.from(await res.arrayBuffer()));
console.log("Narration saved for video editing.");
