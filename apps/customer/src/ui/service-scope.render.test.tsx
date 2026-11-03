import {describe,it,expect,vi} from 'vitest';
import {create,act} from 'react-test-renderer';
import {createElement} from 'react';
import {ServiceScope} from './ServiceScope';
function texts(node:any):string {if(node===null||node===undefined)return '';if(typeof node==='string')return node;if(Array.isArray(node))return node.map(texts).join(' ');return texts(node.children);}
describe('rendered service scope',()=>{
 it('renders exact current multiline description and working question/contact actions',async()=>{const ask=vi.fn();let r:any;await act(async()=>{r=create(createElement(ServiceScope,{service:{name:'New product',description:'Actual scope.\n- Listed second step',category:'ceramic'},onAsk:ask}));});const text=texts(r.toJSON());expect(text).toContain('Actual scope.');expect(text).toContain('Listed second step');expect(text).not.toContain('Paint prep');expect(text).toContain('Is paint correction included or quoted separately?');expect(text).toContain('Tap a question to open Help & contact.');const clickable=r.root.findAll((n:any)=>n.props.onPress===ask);expect(clickable.length).toBeGreaterThanOrEqual(4);await act(async()=>{clickable[0].props.onPress();});expect(ask).toHaveBeenCalledOnce();});
 it('renders explicit missing-scope fallback without invented inclusions',async()=>{let r:any;await act(async()=>{r=create(createElement(ServiceScope,{service:{name:'Empty service',description:'',category:'ppf'},onAsk:()=>{}}));});const text=texts(r.toJSON());expect(text).toContain('Confirm the service scope');expect(text).toContain('Ask the studio what is included for your car.');expect(text).not.toContain('Film fitted');});
});
