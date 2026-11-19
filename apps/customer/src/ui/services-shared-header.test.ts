import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const route = readFileSync(new URL('../app/(tabs)/catalogue/index.tsx', import.meta.url), 'utf8');
const journey = readFileSync(new URL('./ServiceJourney.tsx', import.meta.url), 'utf8');
describe('Services root shared-header wiring', () => {
  it('uses PageHeader above root search, and keeps pinned search on nested/review screens', () => {
    expect(route).toContain('const sharedRootHeader=!path.home&&!reviewing;');
    expect(route).toContain('compactContent={!sharedRootHeader}');
    expect(route).toContain('top={sharedRootHeader?undefined:top}');
    expect(route).toContain('header={sharedRootHeader?<PageHeader');
    expect(route).toContain('{sharedRootHeader?top:null}');
    expect(route.indexOf('header={sharedRootHeader?<PageHeader')).toBeLessThan(route.indexOf('{sharedRootHeader?top:null}'));
  });
  it('hides only the duplicate root intro, preserving default and nested behavior', () => {
    expect(route).toContain('showRootHeader={!sharedRootHeader}');
    expect(journey).toContain('showRootHeader=true');
    expect(journey).toContain('{showRootHeader?<SceneIntro compact eyebrow="Services" title="Care for your car"/>:null}');
    expect(journey).toContain("width:h.wide?'100%':tileWidth");
    expect(journey).toContain("title:'All services',onPress:()=>onPath({})");
  });
});

const garage = readFileSync(new URL('../app/(tabs)/garage/index.tsx', import.meta.url), 'utf8');
it('Garage tab shares PageHeader without a second SceneIntro', () => {
  expect(garage).toContain('<Screen appBar="Garage" header={<PageHeader title="Your cars"');
  expect(garage).not.toContain('<SceneIntro');
  expect(garage).toContain('testID="garage-swipe-area"');
  expect(garage).toContain('testID="garage-car-stack"');
});

it('inner category menus use open sections while search and cart keep compact rows',()=>{expect(journey).toContain('testID="category-editorial-section"');expect(journey).toContain('shown.length?path.home&&!q?groups.map(categorySection)');expect(journey).toContain("categoryView==='compare'||focused===s.id");expect(journey).toContain("'Explore '+s.name");expect(journey).toContain("'Compare services'");expect(journey).toContain("selected.map(row)");});
it('Back is plain text with an invisible target, no rounded surface',()=>{const bar=readFileSync(new URL('./AppBar.tsx',import.meta.url),'utf8');const back=bar.slice(bar.indexOf('accessibilityLabel="Back"'),bar.indexOf(') : ('));expect(back).toContain('width: 46, height: 46');expect(back).toContain('backgroundColor:"transparent"');expect(back).not.toContain('borderRadius');expect(back).not.toContain('r.round');});
