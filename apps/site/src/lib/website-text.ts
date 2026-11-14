// Price-free website copy, including older/over-wide publication payloads.
export function websiteText(value:unknown):string{
 if(typeof value!=='string')return '';
 return /(?:₹|\b(?:INR|Rs\.?|USD|EUR|GBP)\s*\d|[$€£]\s*\d|\d[\d,.]*\s*(?:rupees?|paise)\b)/i.test(value)?'':value;
}
