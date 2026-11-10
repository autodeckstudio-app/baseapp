/** Small monochrome outlines for job facts; never emoji or status claims. */
export function JobSummaryIcon({name}:{name:'car'|'tools'|'invoice'|'payments'|'chevron'|'shield'}){
 const paths={shield:<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/>,car:<><path d="m5 8 2-4h10l2 4M3 9h18v8H3zM6 17v3m12-3v3M6 12h2m8 0h2"/></>,tools:<><path d="M14 4a5 5 0 0 0-6 6L3 15a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-3-3 3-3z"/></>,invoice:<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3"/></>,payments:<><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></>,chevron:<path d="m8 10 4 4 4-4"/>};
 return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
