import {View} from 'react-native';
import {useAuth} from '../hooks/useAuth';
import {useVisitInvoicePdf} from '../lib/use-visit-invoice-pdf';
import {Button,T} from './kit';
export function VisitInvoicePdf({invoiceId}:{invoiceId:string}){
 const auth=useAuth();const scope=auth.status==='ready'&&auth.claims.role==='customer'&&auth.customerDocId?JSON.stringify([auth.user.uid,auth.claims.tenantId,auth.claims.role,auth.customerDocId]):null;
 const pdf=useVisitInvoicePdf(invoiceId,scope);
 return <View style={{gap:8}}><Button label={pdf.label} kind="quiet" disabled={pdf.disabled} onPress={()=>void pdf.press()}/>{pdf.error?<T role="caption" tone="secondary">{pdf.error}</T>:null}</View>;
}
