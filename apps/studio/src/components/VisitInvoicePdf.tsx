import {View,Text} from 'react-native';
import {Button,colors} from '@autodeck/ui';
import {useAuth} from '../hooks/useAuth';
import {useVisitInvoicePdf} from '../lib/use-visit-invoice-pdf';
export function VisitInvoicePdf({invoiceId}:{invoiceId:string}){
 const auth=useAuth();const scope=auth.status==='ready'&&['studio','admin','superadmin'].includes(auth.claims.role)?JSON.stringify([auth.user.uid,auth.claims.tenantId,auth.claims.role,auth.claims.studioId]):null;
 const pdf=useVisitInvoicePdf(invoiceId,scope);
 return <View style={{gap:8}}><Button label={pdf.label} variant="ghost" disabled={pdf.disabled} onPress={()=>void pdf.press()}/>{pdf.error?<Text style={{color:colors.textMuted}}>{pdf.error}</Text>:null}</View>;
}
