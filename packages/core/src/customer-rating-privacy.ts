/** Display normalization for legacy generic service labels, never a service-to-rating lookup.
 * Brand/product names and arbitrary trailing letters are left intact.
 * A generic PPF scope or unbranded coating scope followed by a one-letter variant
 * is displayed without that internal variant. No rating value is returned.
 */
export function customerServiceName(name:string):string {
 return /^(?:PPF (?:Full Body|Full Front|High-Impact Kit)|Ceramic Coating(?: \d+-Year)?) [A-Z]$/.test(name)?name.slice(0,-2):name;
}
/** No identity, manufacturer, price, term or operational status is inferred. */
export function customerRatingPrivacy<T extends {name:string}>(row:T):T {
 const copy={...row,name:customerServiceName(row.name)} as T&Record<string,unknown>;
 for(const key of ['rating','internalRating','serviceRating','ratingNotes','ratingRank'])delete copy[key];
 return copy;
}
