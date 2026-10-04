import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((x) =>
      x.isDirectory() ? walk(path.join(dir, x.name)) : [path.join(dir, x.name)],
    );
}
const files = walk("dist")
  .filter((f) => !f.endsWith("sw.js"))
  .map((f) => f.replaceAll("\\", "/").replace(/^dist\//, ""));
const hash = crypto.createHash("sha256");
for (const f of files) hash.update(fs.readFileSync("dist/" + f));
const cache = "pakka-" + hash.digest("hex").slice(0, 12);
fs.writeFileSync(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(cache)};
const ASSETS=${JSON.stringify(files)};
const absolute=p=>new URL(p,self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS.map(absolute));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data==='CHECK_READY')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const checks=await Promise.all(ASSETS.map(p=>cache.match(absolute(p))));event.ports[0]?.postMessage({ready:checks.every(Boolean),version:CACHE});})());});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cache=await caches.open(CACHE);const saved=await cache.match(event.request,{ignoreVary:true});if(saved)return saved;if(event.request.mode==='navigate')return await cache.match(absolute('index.html'))||fetch(event.request);return fetch(event.request);})());});
`,
);
console.log("Precached " + files.length + " assets in " + cache);
