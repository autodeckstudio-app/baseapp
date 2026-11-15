/** Scope stays visible: loaded records are not the full history or ledger. */
export function BoundedListNotice({kind,limit}:{kind:'bookings'|'payments';limit:number}){
 const booking=kind==='bookings';
 return <aside role="note" className="ax-feed-scope" aria-label="Loaded view limits">
  <div><strong>Up to {limit} {kind}</strong><span>{booking?'Newest scheduled slot first':'Newest created first'}</span></div>
  <dl className="ax-scope-facts"><div><dt>{booking?'Counts, filters & search':'Filters & figures'}</dt><dd>Loaded {kind} only</dd></div><div><dt>{booking?'Full history':'Full ledger & historical balance'}</dt><dd>Not included in this view</dd></div></dl>
 </aside>;
}
