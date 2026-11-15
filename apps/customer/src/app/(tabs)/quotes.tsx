import { AppState } from 'react-native';
import { QuoteInboxIntro } from '../../ui/QuoteInboxIntro';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { getServiceCatalogue } from '../../lib/catalogue-service';
import { listenToMyVehicles } from '../../lib/vehicle-service';
import type { Service, Vehicle } from '@autodeck/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Loading, Notice, Screen } from '../../ui/kit';
import { CustomerQuotePanel } from '../../ui/CustomerQuotePanel';
import { SERVICE_QUOTE_JOURNEY_READY, getServiceQuotes, type CustomerQuote, type QuoteCursor } from '../../lib/service-quote';

export default function Quotes() {
  const router = useRouter(), auth = useAuth();
  const [services, setServices] = useState<Service[]>([]), [cars, setCars] = useState<Vehicle[]>([]);
  const owner = auth.status === 'ready' && auth.customerDocId
    ? JSON.stringify([auth.user.uid, auth.claims.tenantId, auth.customerDocId, auth.claims.role]) : null;
  const scope = useRef({ owner, epoch: 0 });
  if (scope.current.owner !== owner) scope.current = { owner, epoch: scope.current.epoch + 1 };
  const key = JSON.stringify([owner, scope.current.epoch]);
  const current = useRef(key); current.current = key;
  const pageCount=useRef(1),foreground=useRef(AppState.currentState==='active');
  const session = useRef(0), generation = useRef(0), active = useRef(false), loadingRef = useRef(false);
  const [busy, setBusy] = useState(false), [rows, setRows] = useState<CustomerQuote[] | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null), [error, setError] = useState(false);
  const [limited, setLimited] = useState(false), [cursor, setCursor] = useState<QuoteCursor | null>(null);
  const cursorRef = useRef(cursor); cursorRef.current = cursor;

  useEffect(() => {
    setServices([]);
    if (!SERVICE_QUOTE_JOURNEY_READY || !owner) return;
    let alive = true;
    void getServiceCatalogue().then(s => { if (alive) setServices(s); }).catch(() => { if (alive) setServices([]); });
    return () => { alive = false; };
  }, [owner]);
  useEffect(() => {
    setCars([]);
    if (!SERVICE_QUOTE_JOURNEY_READY || auth.status !== 'ready' || !auth.customerDocId) return;
    let alive = true;
    const stop = listenToMyVehicles(auth.customerDocId, auth.claims.tenantId,
      v => { if (alive) setCars(v); }, () => { if (alive) setCars([]); });
    return () => { alive = false; stop(); };
  }, [owner]);

  const load = useCallback(async (more = false) => {
    if (!SERVICE_QUOTE_JOURNEY_READY || !owner || !active.current || !foreground.current || loadingRef.current) return;
    const requestKey = key, gen = ++generation.current;
    const after = more ? cursorRef.current : null;
    if (more && !after) return;
    loadingRef.current = true; setBusy(true); setError(false);
    const valid = () => active.current && foreground.current && current.current === requestKey && generation.current === gen;
    try {
      let r = await getServiceQuotes(after ?? undefined);
      if(!more){const combined=[...r.quotes];for(let page=1;page<pageCount.current&&r.nextCursor;page++){if(!valid())return;r=await getServiceQuotes(r.nextCursor);combined.push(...r.quotes)}r={...r,quotes:[...new Map(combined.map(q=>[q.id,q])).values()]};}
      if (!valid()) return;
      setRows(old => more ? [...new Map([...(old ?? []), ...r.quotes].map(q => [q.id, q])).values()] : r.quotes);
      if(more)pageCount.current++;
      setLimited(r.limited); setCursor(r.nextCursor); setLoadedKey(requestKey);
    } catch { if (valid()) {setError(true);setRows(null);} }
    finally { if (valid()) { loadingRef.current = false; setBusy(false); } }
  }, [owner, key]);

  useFocusEffect(useCallback(() => {
    active.current = true; foreground.current=AppState.currentState==='active'; pageCount.current=1; session.current++; generation.current++; loadingRef.current = false;
    setRows(null); setLoadedKey(null); setCursor(null); setLimited(false); setError(false); setBusy(false);
    void load();
    const timer=setInterval(()=>{if(foreground.current)void load()},60000);
    const subscription=AppState.addEventListener('change',state=>{foreground.current=state==='active';if(foreground.current)void load();else{generation.current++;loadingRef.current=false;setBusy(false)}});
    return () => { clearInterval(timer);subscription.remove(); active.current = false; session.current++; generation.current++; loadingRef.current = false; };
  }, [load]));
  const visible = loadedKey === key ? rows : null;
  const renderSession = session.current;
  const canApply = () => active.current && foreground.current && current.current === key && session.current === renderSession;

  return <Screen appBar="Your quotes"><QuoteInboxIntro/>
    {!SERVICE_QUOTE_JOURNEY_READY ? <Notice title="Not active in this candidate" body="Server, booking and native acceptance checks must pass before this journey is released."/>
      : auth.status === 'ready' && !auth.customerDocId ? <Notice title={auth.claims.role !== 'customer' ? 'Quotes use a customer account' : 'Customer profile could not be verified'} body={auth.claims.role !== 'customer' ? 'You are signed in with a staff or admin account. You can browse services here, but quote requests need a customer account. Your staff access has not changed.' : 'We could not verify the customer profile linked to this sign-in. Your quotes have not been changed. Return to your account and try signing in again, or contact the studio.'} action={<Button label="Go to your account" onPress={() => router.navigate('/(tabs)/profile')}/>}/>
      : !owner ? <Notice title="Sign in to see your quotes" body="Your requests stay with your profile."/>
      : <>
        {error ? <Notice title="Quotes could not load" body="Your requests have not changed. Reconnect and try again." action={<Button kind="quiet" label="Retry" disabled={busy} onPress={()=>void load()}/>}/> : null}
        {visible === null && !error ? <Loading/> : null}
        {visible?.length === 0 ? <Notice title="No custom quotes yet" body="Studio quotes appear here."/> : null}
        {visible?.map(q => <CustomerQuotePanel compact serviceName={services.find(s => s.id === q.scope.serviceId)?.name}
          vehicleLabel={(() => { const car = cars.find(c => c.id === q.scope.vehicleId); return car ? [car.make, car.model, car.registrationNumber].filter(Boolean).join(' · ') : undefined; })()}
          key={`${key}:${q.id}:${q.offer?.revision ?? 0}:${q.scope.serviceId ?? 'reference'}`} quote={q}
          vehicleCategory={cars.find(c => c.id === q.scope.vehicleId)?.category} category={services.find(s => s.id === q.scope.serviceId && s.active)?.category}
          onBooked={b => { if (canApply()) router.push({ pathname: '/(tabs)/bookings/[id]', params: { id: b.id } } as never); }}
          onChange={next => { if (canApply()) { generation.current++; loadingRef.current = false; setBusy(false); setRows(old => old?.map(x => x.id === next.id && next.version >= x.version ? next : x) ?? null); void load(); } }}/>) }
        {loadedKey === key && limited ? <Button kind="quiet" label="Load earlier requests" disabled={busy} onPress={() => void load(true)}/> : null}
      </>}
  </Screen>;
}
