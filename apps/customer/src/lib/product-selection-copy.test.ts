import inventory from '../../../../docs/product-description-current-inventory-20261117.json';
import {describe,it,expect} from 'vitest';
import copy from './product-selection-copy.json';
import {productSelectionDescription} from './product-selection-copy';
describe('reviewed product selection copy',()=>{
 it('has a short separate paragraph and two key points for each verified identity',()=>{for(const row of Object.values(copy)){expect(row.summary.split(/\s+/).length).toBeGreaterThanOrEqual(10);expect(row.summary.split(/\s+/).length).toBeLessThan(48);expect(row.keyPoints).toHaveLength(2);expect(row.keyPoints.every(x=>x!==row.summary)).toBe(true);}});
 it('does not invent a match for an unverified exact product',()=>{for(const name of ['Keramic 10H Graphene','Keramik 10H Graphene','NAR M1','Fireball Butterfly 2','Fireball Wizard Graphene'])expect(productSelectionDescription({name,description:'Original pending copy'})).toBe('Original pending copy');});
 it('keeps exact Butterfly identities separate',()=>{expect(productSelectionDescription({name:'Fireball Butterfly'})).not.toBe(productSelectionDescription({name:'Fireball Butterfly Graphene'}));});
 it('preserves restrictions without duplicating them',()=>{expect(productSelectionDescription({name:'Kovalent Graphene Matrix',description:'Old summary\nNot for matte paint\nDo not heat at home'}).match(/Not for matte paint/g)).toHaveLength(1);expect(productSelectionDescription({name:'Kovalent Graphene Matrix',description:'Old\nDo not heat at home'})).toContain('Do not heat at home');});
 it('does not mutate the source object or change prices, warranties or duration',()=>{const row={name:'Cosmo Gold',description:'Old',basePrice:8500000,warrantyLabel:'Existing',estimatedDurationMinutes:480};const original=JSON.stringify(row);productSelectionDescription(row);expect(JSON.stringify(row)).toBe(original);});
});

it('maker-only copy has no inferred suitability or price tier claims',()=>{for(const row of Object.values(copy))expect(row.summary).not.toMatch(/Suits owners|Choose it|Worth discussing|lower.price|middle option|step.up/i);expect(productSelectionDescription({name:'Keramik 9H Nano'})).not.toMatch(/water.repellent|hydrophob/i);expect(productSelectionDescription({name:'Keramic 9H Nano'})).not.toMatch(/water.repellent|hydrophob/i);});

it('current restrictions and held original descriptions remain available',()=>{for(const row of inventory.rows){const result=productSelectionDescription({name:row.name,description:row.originalDescription});for(const restriction of row.originalRestrictions)expect(result).toContain(restriction);if(!Object.hasOwn(copy,row.name))expect(result).toBe(row.originalDescription);}});

it('keeps Fireball customer benefits readable without chemistry jargon',()=>{for(const name of ['Fireball Devils Blood','Fireball Butterfly Graphene','Fireball DOK DO'])expect(productSelectionDescription({name})).not.toMatch(/polysilazane|siloxane|SiO2|80%|solids|oxides/i);expect(productSelectionDescription({name:'Fireball Devils Blood'})).toContain('water');});
