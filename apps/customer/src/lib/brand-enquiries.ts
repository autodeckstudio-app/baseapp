export type BrandEnquiry={key:string;brand:string|null;name:string;group:'ppf'|'coatings';note:string;source?:string;surface?:string;level?:'brand'};
/** Owner Products plus source-qualified manufacturer ranges checked 3 Nov 2026. Not stock or active bookable services. No costs/terms copied. */
import shared from '../../../../packages/core/src/brand-enquiries.json';
import { customerOfferingVisible } from './customer-offering-visibility';
export const BRAND_ENQUIRIES=(shared as BrandEnquiry[]).filter(customerOfferingVisible);
