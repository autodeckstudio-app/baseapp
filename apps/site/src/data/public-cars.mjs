/** Explicit public allowlist. Never import an admin listing or the app's raw API result here. */
const keys = new Set(['id','make','model','variant','year','kilometres','fuel','transmission','bodyStyle','photo','photoAlt','publicPhotoApproved']);
export function validatePublicCars(rows) {
  if (!Array.isArray(rows)) throw new Error('Public cars must be an array');
  const ids = new Set();
  return rows.map(car => {
    for (const k of Object.keys(car)) if (!keys.has(k)) throw new Error(`Not an allowed public car field: ${k}`);
    if (!/^[a-z0-9-]+$/.test(car.id || '') || ids.has(car.id)) throw new Error('Public car ID must be a unique safe slug, not a registration');
    ids.add(car.id);
    for (const key of ['make','model','variant','fuel','transmission','bodyStyle','photo','photoAlt']) {
      if (car[key] !== undefined && (typeof car[key] !== 'string' || car[key].length > 160)) throw new Error('Public car fields must be short approved strings');
    }
    if (!car.make || !car.model || !car.photo || !car.photoAlt || car.publicPhotoApproved !== true) throw new Error('Real, plate-redacted and metadata-cleaned photo approval required');
    if (!car.photo.startsWith('/assets/inventory/') || /[?#]/.test(car.photo)) throw new Error('Public car photos must use approved local inventory assets');
    const text = [car.id, car.make, car.model, car.variant, car.photo, car.photoAlt].filter(Boolean).join(' ');
    if (/\b[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}\b/i.test(text) || /@|\b\d{10}\b/.test(text)) throw new Error('Possible personal identifier in public car text');
    if (car.year !== undefined && (!Number.isInteger(car.year) || car.year < 1900 || car.year > 2100)) throw new Error('Invalid public year');
    if (car.kilometres !== undefined && (!Number.isFinite(car.kilometres) || car.kilometres < 0)) throw new Error('Invalid public kilometres');
    return { ...car };
  });
}
