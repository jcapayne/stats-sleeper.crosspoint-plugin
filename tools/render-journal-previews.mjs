import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const server = resolve(process.argv[2] || '.worktrees/crosspoint-sync');
const output = resolve('artifacts/journal');
mkdirSync(output, { recursive: true });
const { renderSleepImage } = await import(pathToFileURL(join(server, 'dist/render/sleep-image.js')));
const { parseSleepOptions } = await import(pathToFileURL(join(server, 'dist/models/sleep-image.js')));
const { SleepGraphics } = await import(pathToFileURL(join(server, 'dist/render/sleep-graphics.js')));
const { PNG } = createRequire(join(server, 'package.json'))('pngjs');

// Original geometric sample artwork, not a fetched book cover or reference crop.
const art = new SleepGraphics(480,800,true);
art.roundRect(0,0,480,800,0,170);
art.disc(330,280,95,255);
art.fill([[{x:0,y:460},{x:155,y:310},{x:310,y:450},{x:480,y:350},{x:480,y:800},{x:0,y:800}]],85);
art.fill([[{x:0,y:540},{x:170,y:455},{x:325,y:535},{x:480,y:470},{x:480,y:800},{x:0,y:800}]],0);
art.text('A little further.',240,130,35,{align:'center',maxWidth:400});
art.text('ONE PAGE AT A TIME',240,166,11,{align:'center',tracking:140});
const background = PNG.sync.write(art.image);
writeFileSync(join(output,'sample-artwork.png'),background);

for (const [name,finished,target,currentPercent,streak] of [
  ['progress',12,24,42,7], ['celebration',24,24,42,7], ['reader-sample',4,6,59,2],
]) {
  const stats = {year:2026,finished,target,currentPercent,streak};
  const overlay = renderSleepImage(stats,parseSleepOptions({mode:'overlay',preview:'1'}));
  const custom = renderSleepImage(stats,parseSleepOptions({mode:'custom',preview:'1'}));
  writeFileSync(join(output,`${name}-overlay.png`),overlay.bytes);
  writeFileSync(join(output,`${name}-custom.png`),custom.bytes);
  const blended = PNG.sync.read(overlay.bytes);
  for (let p=0;p<blended.data.length;p+=4) {
    const alpha=blended.data[p+3]/255;
    const gray=Math.round(blended.data[p]*alpha+art.image.data[p]*(1-alpha));
    blended.data.set([gray,gray,gray,255],p);
  }
  writeFileSync(join(output,`${name}-overlay-preview.png`),PNG.sync.write(blended));
  const sheet = new SleepGraphics(1008,864,true);
  sheet.text('Cover + Transparent',264,28,17,{align:'center'});
  sheet.text('Custom wallpaper',744,28,17,{align:'center'});
  const right = PNG.sync.read(custom.bytes);
  for (const [image,x] of [[blended,16],[right,512]]) for (let y=0;y<800;y++) {
    image.data.copy(sheet.image.data,((y+44)*1008+x)*4,y*480*4,(y+1)*480*4);
  }
  sheet.text('Illustrative artwork and sample account data',504,858,10,{align:'center',gray:85});
  writeFileSync(join(output,`${name}-comparison.png`),PNG.sync.write(sheet.image));
}
const customArt = renderSleepImage({year:2026,finished:12,target:24,currentPercent:42,streak:7},parseSleepOptions({mode:'custom',preview:'1'}),background);
writeFileSync(join(output,'framed-artwork-custom.png'),customArt.bytes);
console.log(`Journal previews written to ${output}`);
