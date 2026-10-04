import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import ffmpeg from 'ffmpeg-static';

const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const excerpt = (file, marker, lines) => {
 const source = fs.readFileSync(file,'utf8');
 const index = source.indexOf(marker);
 if(index<0)throw Error('Missing code marker: '+marker);
 return source.slice(index).split('\n').slice(0,lines).join('\n');
};
const evaluation = JSON.parse(fs.readFileSync('docs/evaluation.json','utf8'));
const record = JSON.parse(fs.readFileSync('data/train.json','utf8')).find(r=>r.labels.length===2);
const model = JSON.parse(fs.readFileSync('public/model.json','utf8'));
const domainSource = fs.readFileSync('src/domain.ts','utf8');
const approvalGate = domainSource.slice(domainSource.indexOf('export function canApprove'),domainSource.indexOf('export function approve')).trim();
const blocks = [
 {
  title:'Small AI. Explicit rules. Human approval.', tag:'01 / Architecture', duration:7,
  body:'<p>React + TypeScript + Vite</p><p>Five browser-based topic classifiers</p><p>Every promise comes from reviewed host facts.</p>',
  panel:'<div class="flow">'+['English guest text','Local topic mentions','Deterministic comparisons','Operator review & approval','Fixed English / Urdu receipt'].map((x,i)=>`<div><span>0${i+1}</span>${x}</div>`).join('')+'</div>', caption:'Actual implementation · src/domain.ts + src/App.tsx'
 },
 {
  title:'Synthetic data, separated before training.', tag:'02 / Model provenance', duration:11,
  body:'<div class="numbers"><div><b>600</b>training</div><div><b>150</b>validation</div><div><b>150</b>held-out</div></div><p>20 / 5 / 5 distinct template families</p><p>Zero exact duplicate texts. Zero family overlap.</p><p class="note">Topic mentions include negations. This is a small synthetic evaluation.</p>',
  panel:`<div class="file">data/train.json · actual synthetic record</div><pre>${escape(JSON.stringify(record,null,2))}</pre>`,caption:'Word unigrams + adjacent bigrams · five logistic classifiers · seeded training'
 },
 {
  title:'Measure the model. Report the failures.',tag:'03 / Held-out evaluation',duration:13,
  body:`<p class="asset"><b>${evaluation.modelBytes.toLocaleString()}</b> bytes</p><p>Vocabulary, weights, biases, thresholds, and metadata.</p><p>Browser inference needs no runtime ML service.</p><p class="note">The keyword baseline wins. The classifier never authorizes a promise.</p>`,
  panel:`<div class="file">docs/evaluation.json · measured results</div><table><tr><th></th><th>Local model</th><th>Keywords</th></tr><tr><td>Micro F1</td><td>${(evaluation.classifier.microF1*100).toFixed(1)}%</td><td>${(evaluation.keywordBaseline.microF1*100).toFixed(1)}%</td></tr><tr><td>Macro F1</td><td>${(evaluation.classifier.macroF1*100).toFixed(1)}%</td><td>${(evaluation.keywordBaseline.macroF1*100).toFixed(1)}%</td></tr><tr><td>Exact labels</td><td>${(evaluation.classifier.exactMatch*100).toFixed(1)}%</td><td>${(evaluation.keywordBaseline.exactMatch*100).toFixed(1)}%</td></tr></table><p class="failure">${evaluation.classifier.failures.length} / 150 classifier examples contain an error.<br>Every failure is included in the report.</p><div class="model-labels">${model.labels.map(x=>`<span>${escape(x)}</span>`).join('')}</div>`,caption:'No held-out fitting · no invented accuracy · operator review is required'
 },
 {
  title:'A corrected interpretation is reviewed again.',tag:'04 / Comparison & receipt safety',duration:14,
  body:'<p>Parse explicit counts, times, and durations.</p><p>Compare with saved capacity, hours, and features.</p><p>Keep ambiguity and unknown details as questions.</p><p>Approved snapshots fill authored bilingual templates.</p>',
  panel:`<div class="file">src/domain.ts · actual approval gate</div><pre>${escape(approvalGate)}</pre><div class="checks">✓ Every interpretation reviewed<br>✓ Current request matches analysis<br>✓ Valid saved host facts</div>`,caption:'Facts / text / interpretation edits invalidate approval · Guest agreement pending'
 },
 {
  title:'Offline reload, verified in the browser.',tag:'05 / Shipping & verification',duration:11,
  body:'<div class="numbers"><div><b>31</b>logic tests</div><div><b>6</b>browser tests</div></div><p>App shell, styles, icons, and model are precached.</p><p>Local facts and approved receipts survive reload.</p><p class="note">English input only. Urdu templates need native-speaker review.</p>',
  panel:`<div class="file">scripts/service-worker.mjs · actual cache install</div><pre>${escape(excerpt('scripts/service-worker.mjs',"self.addEventListener('install'",1))}</pre><div class="checks">✓ Complete flow<br>✓ Edited host facts<br>✓ Uncertain requests<br>✓ Accurate bilingual receipt<br>✓ Network disabled + reload</div>`,caption:'Public GitHub repository · reproducible training · no external runtime APIs'
 }
];
const html = (s,i)=>`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#faf6ed;color:#244634;font:22px Arial,sans-serif}header{height:83px;padding:0 55px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d9dfd0}.brand{font:700 36px Georgia;color:#174d38}.badge{font-size:15px;letter-spacing:2px;color:#61735d}main{padding:34px 55px}h1{font:40px Georgia;margin:12px 0 28px;line-height:1.2}.tag{font-size:13px;letter-spacing:1.8px;color:#7d866f;text-transform:uppercase}.content{display:grid;grid-template-columns:460px 1fr;gap:35px;height:425px}.body p{font-size:21px;line-height:1.5;margin:0 0 17px}.body p.note{font-size:17px;color:#677560}.panel{border:1px solid #d4decd;background:#fffdf7;border-radius:14px;padding:22px;overflow:hidden}.file{font-size:14px;letter-spacing:.5px;color:#6b7b61;margin-bottom:17px}pre{font:15px/1.45 Consolas,monospace;white-space:pre-wrap;margin:0;color:#1c5138;overflow-wrap:anywhere}.flow{display:flex;flex-direction:column;gap:14px}.flow>div{background:#edf2e6;border:1px solid #cbdabf;border-radius:9px;padding:14px;font-size:20px}.flow span{font-size:13px;margin-right:20px;color:#76876a}.numbers{display:flex;gap:22px;margin-bottom:28px}.numbers>div{font-size:15px;color:#6a795f}.numbers b{display:block;font:44px Georgia;color:#174d38;margin-bottom:9px}.asset b{font:55px Georgia}.asset{margin-bottom:19px!important}table{border-collapse:collapse;width:100%;font-size:19px}td,th{text-align:left;padding:14px 7px;border-bottom:1px solid #dce4d4}th{font-size:14px;color:#728468}td:nth-child(2){color:#92502d}td:nth-child(3){color:#174d38}.failure{background:#f7ecd6;padding:17px;font-size:18px;line-height:1.5;color:#76591f;border-radius:9px}.model-labels{display:flex;gap:7px;flex-wrap:wrap}.model-labels span{background:#edf1e5;padding:8px;border-radius:6px;font-size:13px}.checks{background:#edf3e6;padding:17px 24px;font-size:20px;line-height:1.75;border-radius:9px;margin-top:22px}footer{position:absolute;bottom:0;height:59px;border-top:1px solid #dce1d3;width:100%;padding:20px 55px;display:flex;justify-content:space-between;font-size:14px;color:#62775d}
</style></head><body><header><span class="brand">pakka.</span><span class="badge">TECHNICAL WALKTHROUGH · 2AM</span></header><main><span class="tag">${s.tag}</span><h1>${s.title}</h1><div class="content"><div class="body">${s.body}</div><div class="panel">${s.panel}</div></div></main><footer><span>${s.caption}</span><span>${i+1} / 5</span></footer></body></html>`;
fs.mkdirSync('.cache/technical-frames',{recursive:true});fs.mkdirSync('submission',{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});
let concat='';
for(let i=0;i<blocks.length;i++){await page.setContent(html(blocks[i],i));const file=path.resolve(`.cache/technical-frames/${i}.png`).replaceAll('\\','/');await page.screenshot({path:file});concat+=`file '${file}'\nduration ${blocks[i].duration}\n`;}
concat+=`file '${path.resolve('.cache/technical-frames/4.png').replaceAll('\\','/')}'\n`;
await browser.close();fs.writeFileSync('.cache/technical-frames/concat.txt',concat);
const output='submission/technical-walkthrough.mp4';
const r=spawnSync(ffmpeg,['-y','-f','concat','-safe','0','-i','.cache/technical-frames/concat.txt','-i','submission/technical-narration.mp3','-filter_complex','[1:a]apad[a]','-map','0:v','-map','[a]','-t','56','-r','25','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',output],{encoding:'utf8'});
if(r.status!==0)throw Error(r.stderr);
const probe=spawnSync(ffmpeg,['-i',output,'-f','null','-'],{encoding:'utf8'});const d=probe.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);if(!d)throw Error('No measured video duration');const seconds=Number(d[1])*3600+Number(d[2])*60+Number(d[3]);if(seconds>60)throw Error('Video exceeds limit');
fs.copyFileSync('demo/pakka-demo.mp4','submission/product-demo.mp4');
fs.writeFileSync('submission/technical-metadata.json',JSON.stringify({durationSeconds:seconds,bytes:fs.statSync(output).size,narrationProvider:'ElevenLabs',voice:'Bella',narrationSeconds:54.706213151927436,visuals:'Actual source excerpts, dataset records, and measured results from this repository'},null,2)+'\n');console.log(`Technical walkthrough: ${seconds}s, ${fs.statSync(output).size} bytes.`);
