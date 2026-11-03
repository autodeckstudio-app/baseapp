export type BrandEnquiry={key:string;brand:string|null;name:string;group:'ppf'|'coatings';note:string;source?:string;surface?:string};
/** Owner Products plus source-qualified manufacturer ranges checked 3 Nov 2026. Not stock or active bookable services. No costs/terms copied. */
import shared from '../../../../packages/core/src/brand-enquiries.json';
export const BRAND_ENQUIRIES=shared as BrandEnquiry[];
