import type { ServiceCategory } from '@autodeck/core';
/** Questions, not promised deliverables. Exact answers come from the studio. */
export function serviceQuestions(category: ServiceCategory): string[] {
 if(category==='ppf')return ['Which panels and edges are covered, and which are excluded?','Which film and finish will be fitted?','What are the written warranty terms and care instructions?'];
 if(category==='ceramic'||category==='coating')return ['Which surfaces and preparation steps are included?','Is paint correction included or quoted separately?','Which product, curing time and written warranty apply?'];
 if(category==='garage'||category==='inspection')return ['What will be checked and reported?','Are parts, fluids and labour included or quoted separately?','What work needs my approval after the inspection?'];
 if(category==='modifications'||category==='tinting')return ['What material, finish and areas are covered?','What fitting, removal and care work is included?','Is this option suitable and permitted for my car?'];
 if(category==='pickup')return ['Is collection, return or both included?','Which address, timing and distance charges apply?'];
 return ['Which interior and exterior areas are included?','Do stains, odour or delicate materials need separate work?','How long should I allow before using the car?'];
}
