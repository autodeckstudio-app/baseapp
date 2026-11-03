import {Linking,View} from 'react-native';
import type {Service} from '@autodeck/core';
import {space} from '@autodeck/ui/theme';
import {Button,Kicker,Notice,Pane,Row,T} from './kit';
import {showcaseFor} from '../lib/showcase';
import {manufacturerInfo} from '../lib/manufacturer-info';
import {serviceQuestions} from '../lib/service-questions';
/** Only catalogue-authored scope; confirmation questions never become promises. */
export function ServiceScope({service,onAsk}:{service:Pick<Service,'name'|'description'|'category'> & Partial<Pick<Service,'brand'>>;onAsk:()=>void}) {
 const maker=manufacturerInfo({...service,brand:service.brand??null});
 const scope=showcaseFor(service).included;
 return <>
  {scope.length ? <View style={{gap:space.breath}}><Kicker>Service details</Kicker><Pane pad="gap">{scope.map((text,i)=><Row key={text} title={text} last={i===scope.length-1}/>)}</Pane></View> : <Notice title="Confirm the service scope" body="Ask the studio what is included for your car." action={<Button kind="quiet" label="Help & contact" onPress={onAsk}/>}/>}
  <T role="caption" tone="secondary">Need extra work? Ask the studio before booking.</T>
  <Row title="Ask about this service" detail="Contact the studio about inclusions, exclusions and care" onPress={onAsk} last/>
  {maker?<View style={{gap:space.breath}}><Kicker>Product and care</Kicker><Pane pad="gap"><T>{maker.summary}</T>{maker.notes.map(note=><T key={note} tone="secondary">{note}</T>)}{maker.sources.map(source=><Row key={source.url} title={source.label} detail="Manufacturer's website" onPress={()=>void Linking.openURL(source.url)} last/>)}</Pane><T role="caption" tone="tertiary">Ask for your product care guide and written warranty at handover.</T></View>:null}
  <View style={{gap:space.breath}}><Kicker>Before you book</Kicker><T role="caption" tone="secondary">Tap a question to open Help & contact.</T><Pane pad="gap">{serviceQuestions(service.category).map((question,i,all)=><Row key={question} title={question} onPress={onAsk} last={i===all.length-1}/>)}</Pane></View>
 </>;
}
