import { it, expect, vi } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const h=vi.hoisted(()=>({os:'web'}));
vi.mock('react-native',()=>({Platform:{get OS(){return h.os}}}));
const files=['ceramic-coating','detailing','garage','modifications','paint-protection','wash-and-care'];
it('web-only category selection keeps native JPEG originals in source',()=>{
 const source=readFileSync(new URL('./imagery.ts',import.meta.url),'utf8');
 for(const name of ['catPpf','catCeramic','catDetailing','catWash','catGarage','catMods'])expect(source).toContain(`const ${name} = Platform.OS === "web" ? ${name}Web : ${name}Original;`);
});
it('encoded web assets have WebP signatures, stay smaller than unchanged originals, and originals retain reviewed hashes',()=>{
 const hashes:Record<string,string>={
  'ceramic-coating':'986e601cbd511a120277fcab4e053969c5f09149343a47cf5f30b6f4dce90080', 'detailing':'5f0dc00a692c491828a7f960c151b9fda3856744abe1d887e4f6ef04082afeb8', 'garage':'ed3a7f56d71254983763bb59f65f32843cf934901fb4f1cdff802f61abaa4d8c', 'modifications':'d479778b8bad052748dd035c632afc79b086b11721bede235a0fe94129ecb856', 'paint-protection':'1971c7c806490316a57bd4ff30344a2a3b27a29af8380b8c226b086f1c444e8d', 'wash-and-care':'4e873e760ac51b1bfc7fbf42718f9dd2f4445b427908770e0621a965cdeb67e0'
 };
 for(const name of files){
  const original=new URL(`../../assets/imagery/category/${name}.jpg`,import.meta.url),web=new URL(`../../assets/imagery/category/${name}.webp`,import.meta.url);const b=readFileSync(web);
  expect(b.toString('ascii',0,4)).toBe('RIFF');expect(b.toString('ascii',8,12)).toBe('WEBP');expect(statSync(web).size).toBeLessThan(statSync(original).size*.6);
  expect(createHash('sha256').update(readFileSync(original)).digest('hex')).toBe(hashes[name]);
 }
 const png=new URL('../../assets/studio/studio-front-night.png',import.meta.url),web=new URL('../../assets/studio/studio-front-night.webp',import.meta.url);
 expect(statSync(web).size).toBeLessThan(statSync(png).size*.15);
});

it('legacy studio source assets remain preserved while grey day/night artwork is selected',()=>{const png=new URL('../../assets/studio/studio-front-night.png',import.meta.url),oldWeb=new URL('../../assets/studio/studio-front-night.webp',import.meta.url),web=oldWeb;expect(createHash('sha256').update(readFileSync(png)).digest('hex')).toBe('35258cee1f1cf99bd223232c62ee602ac7e66c4701426d9beb17174282cba002');expect(createHash('sha256').update(readFileSync(oldWeb)).digest('hex')).toBe('185f22a26ef36df861ff8521a4de70cdd05a4d31c7bd5b5f63ab0ee7b61315a0');const b=readFileSync(web);expect(b.toString('ascii',0,4)).toBe('RIFF');expect(b.toString('ascii',8,12)).toBe('WEBP');expect(statSync(web).size).toBeLessThan(statSync(png).size*.15);const source=readFileSync(new URL('../ui/StudioFooterMockup.tsx',import.meta.url),'utf8');expect(source).toContain("Platform.OS === 'web' ? eveningWeb : eveningOriginal");expect(source).toContain('studio-front-evening-grey.webp');expect(source).toContain('studio-front-evening-grey')});

it('accepted grey-interior day/evening encodings are bundled for both platforms',()=>{for(const period of ['day','evening']){const png=new URL(`../../assets/studio/studio-front-${period}-grey.png`,import.meta.url),web=new URL(`../../assets/studio/studio-front-${period}-grey.webp`,import.meta.url);const b=readFileSync(web);expect(b.toString('ascii',0,4)).toBe('RIFF');expect(statSync(web).size).toBeLessThan(statSync(png).size*.3)}});
