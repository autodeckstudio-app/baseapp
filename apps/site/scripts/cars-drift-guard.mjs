// The cars row drift must switch scroll snap off while drifting, or snap undoes each small step.
import fs from 'node:fs';
const s = fs.readFileSync('src/scripts/home-v2-cars.ts', 'utf8');
if (!/scrollSnapType\s*=\s*drifting\s*\?\s*"none"/.test(s)) { console.error('cars-drift-guard FAIL: snap not disabled while drifting'); process.exit(1); }
console.log('cars-drift-guard ok');
