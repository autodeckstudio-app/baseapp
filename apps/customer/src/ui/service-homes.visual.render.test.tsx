vi.mock('./ServicePhoto',()=>({ServicePhoto:()=>null}));
import React from'react';import{it,vi}from'vitest';vi.mock('./AppBar',()=>({AppBar:()=>null}));
// @ts-expect-error existing server-render harness
import{renderToStaticMarkup}from'react-dom/server';import{StyleSheet,View}from'react-native';import{writeFileSync}from'node:fs';import{ServiceHomes}from'./ServiceHomes';import{T}from'./kit';
it('renders actual default five-home catalogue for pixel inspection',()=>{const html=renderToStaticMarkup(<View style={{padding:20,maxWidth:500,backgroundColor:'#131318'}}><T role="caption">SAMPLE ONLY · NEW CANDIDATE · NOT LIVE</T><ServiceHomes services={[]} onOpen={()=>{}} onReference={()=>{}} priceLabel={()=>null}/></View>);writeFileSync('/tmp/ad-service-homes-current.html',`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#131318}${(StyleSheet as any).getSheet().textContent}</style>${html}`)});
