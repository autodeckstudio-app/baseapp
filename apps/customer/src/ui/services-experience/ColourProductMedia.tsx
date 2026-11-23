import {choiceMediaURLs} from '../../lib/choice-media-web';
/** The selected product image is separate from the large application illustration.
 * Only the two approved Colour PPF assets are shown here. No generic substitute.
 */
export function ColourProductMedia({service}:{service:{id:string;name:string}}){
 if(!['svc_552372faf2dc835012f3321d1982a712','svc_dff9bd93656be1706fc7828bff78ac66'].includes(service.id))return null;
 const media=choiceMediaURLs(service.id);if(!media?.product)return null;
 return <figure style={{margin:'0 0 16px',position:'relative',overflow:'hidden',borderRadius:14}}><img src={media.product} alt={service.name+' product'} style={{display:'block',width:'100%',height:190,objectFit:'cover',borderRadius:14}}/>{service.id==='svc_552372faf2dc835012f3321d1982a712'?<figcaption style={{position:'absolute',left:10,bottom:10,fontSize:11,lineHeight:'16px',background:'rgba(20,25,32,.78)',color:'#fff',padding:'4px 8px',borderRadius:6}}>Illustrative product render.</figcaption>:null}</figure>;
}
