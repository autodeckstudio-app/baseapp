import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
// Interactive service-page Rover with per-vertex coverage highlighting.
// Coverage regions are illustrative, not exact panel maps; glass and trim never tint.
export async function initRoverZones(host:HTMLElement){
 let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'})}catch{return}
 renderer.domElement.addEventListener('webglcontextlost',()=>{host.classList.remove('rover-ready')});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.setClearColor(0,0);host.querySelector('.rover-canvas')!.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.01,100);const pm=new THREE.PMREMGenerator(renderer),env=pm.fromScene(new RoomEnvironment(),.04);scene.environment=env.texture;scene.environmentIntensity=.45;pm.dispose();scene.add(new THREE.HemisphereLight(0xffffff,0x574631,.8));const key=new THREE.DirectionalLight(0xffe4bf,1.4);key.position.set(2,5,4);scene.add(key);
 const gltf=await new GLTFLoader().loadAsync('/assets/models/rover-png-v2.glb');const model=gltf.scene;
 const aniso=renderer.capabilities.getMaxAnisotropy();model.traverse((o:any)=>{if(o.isMesh){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach((m:any)=>{for(const slot of['map','normalMap','roughnessMap','metalnessMap']){const t=(m as any)[slot];if(t)t.anisotropy=aniso}})}});
 model.traverse((o:any)=>{if(o.isMesh){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach((m:any)=>{if(m.roughness!==undefined)m.roughness=Math.max(m.roughness,.55)})}});

 const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());model.position.sub(center);const group=new THREE.Group();group.add(model);group.scale.setScalar(4.5/Math.max(size.x,size.y,size.z));scene.add(group);
 group.rotation.y=-.15;camera.position.set(4,1.6,5.5);camera.lookAt(0,0,0);scene.updateMatrixWorld(true);
 const floor=-size.y*(4.5/Math.max(size.x,size.y,size.z))/2;
 const glowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{glowColor:{value:new THREE.Color(0xf38a35)}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv; uniform vec3 glowColor; void main(){float d=length((vUv-.5)*2.0); float a=pow(max(0.0,1.0-d),2.4)*.3; gl_FragColor=vec4(glowColor,a);}'});
 const glow=new THREE.Mesh(new THREE.PlaneGeometry(6,4),glowMaterial);glow.rotation.x=-Math.PI/2;glow.position.y=floor-.025;scene.add(glow);const under=new THREE.PointLight(0xff963e,2.1,6,2);under.position.set(0,floor+.12,0);scene.add(under);
 // Coverage attribute on painted-body materials only.
 const gbox=new THREE.Box3().setFromObject(group);const gx=gbox.max.x,gy=gbox.max.y,gz=gbox.max.z;
 // Marker mode (garage): no coverage tinting. Small gold markers pulse
 // over typical first-check areas for the selected concern. Markers are
 // illustrative check areas, not coverage and not a diagnosis.
 const markerMode=host.dataset.roverMarkers!==undefined;
 const layerBuild=host.dataset.roverLayerbuild!==undefined;
 const markerSets:THREE.Sprite[][]=[[],[],[]];
 if(markerMode){
  const cv=document.createElement('canvas');cv.width=cv.height=128;
  const cx=cv.getContext('2d')!;
  // Crisp anchored ring + centre dot, not a soft blurred blob.
  cx.strokeStyle='#f5a45a';cx.lineWidth=12;cx.beginPath();cx.arc(64,64,42,0,Math.PI*2);cx.stroke();
  cx.strokeStyle='rgba(255,255,255,.92)';cx.lineWidth=3;cx.beginPath();cx.arc(64,64,42,0,Math.PI*2);cx.stroke();
  cx.fillStyle='#f5a45a';cx.beginPath();cx.arc(64,64,15,0,Math.PI*2);cx.fill();
  cx.fillStyle='#ffffff';cx.beginPath();cx.arc(64,64,6,0,Math.PI*2);cx.fill();
  const tex=new THREE.CanvasTexture(cv);
  const ray=new THREE.Raycaster();const tmpS=new THREE.Vector3();
  // Anchors are measured on the actual model surfaces by raycast, never
  // guessed as bbox fractions: wheels anchor on the outer tyre face,
  // engine on the hood top, cabin on the near-side cabin glass.
  const surface=(from:THREE.Vector3,dir:THREE.Vector3)=>{ray.set(from,dir.normalize());const hits=ray.intersectObject(model,true);return hits.length?group.worldToLocal(hits[0].point.clone()):null};
  const pin=(p:THREE.Vector3)=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:true,opacity:.98}));m.position.copy(p);m.scale.setScalar(.34);return m};
  const boxOf=(n:string)=>{let b:THREE.Box3|null=null;model.traverse((o:any)=>{if(o.isMesh&&o.name===n)b=new THREE.Box3().setFromObject(o)});return b!};
  // Each set owns its sprites; sharing sprite objects across sets would
  // let a later set's visibility pass clobber an earlier set's markers.
  const WHEEL_OBJECTS=['Object_4','Object_24','Object_26','Object_28'];
  const wheelsAt=()=>WHEEL_OBJECTS.map(n=>{const b=boxOf(n),c=b.getCenter(new THREE.Vector3());const s=Math.sign(c.z)||1;const p=surface(new THREE.Vector3(c.x,c.y,s*6),new THREE.Vector3(0,0,-s))??group.worldToLocal(c.clone());p.z+=s*.05;return pin(p)});
  const engineAt=()=>{const b=boxOf('Object_14'),c=b.getCenter(new THREE.Vector3());const p=surface(new THREE.Vector3(c.x+b.getSize(tmpS).x*.18,b.max.y+1,c.z),new THREE.Vector3(0,-1,0))??group.worldToLocal(c.clone());p.y+=.06;return pin(p)};
  const cabinAt=()=>{const b=boxOf('Object_17'),c=b.getCenter(new THREE.Vector3());const p=surface(new THREE.Vector3(c.x,c.y+b.getSize(tmpS).y*.2,6),new THREE.Vector3(0,0,-1))??group.worldToLocal(c.clone());p.z+=.06;return pin(p)};
  markerSets[0]=[engineAt(),cabinAt()];
  markerSets[1]=wheelsAt();
  markerSets[2]=[engineAt(),...wheelsAt()];
  for(const set of markerSets)for(const m of set){m.visible=false;group.add(m)}
 }

 const shaders:{uZone:{value:number};uGlow:{value:number};uTime:{value:number};uBuild:{value:number}}[]=[];
 const pos=new THREE.Vector3();
 // Coverage classification is OBJECT-evidence based, verified with
 // per-object isolation renders of this GLB: Object_6/Object_7 are the
 // painted body shell (the visible roof is part of this shell and is
 // paint), Object_14 the hood and mirror caps (Carbon), and Object_10
 // the side and rear glass - but Object_10 is a MIXED mesh that also
 // contains the front grille lattice and lower intake trim, so its
 // glass highlight is bounded above the beltline (illustrative, not
 // panel-exact). Object_11 is the windshield and panoramic roof glass;
 // the pano section sits under the painted roof shell, so only the
 // windshield shows.
 // Remaining 002-group objects are badges, interior trim, grille slats
 // and tiny fittings; they never tint, and neither do tyres/reflectors.
 // Material names in this model are palette slots, not semantics, so
 // they are not used for classification.
 const GLASS_OBJECTS=new Set(['Object_10']);
 const GLASS_FULL_OBJECTS=new Set(['Object_11']);
 const PAINT_OBJECTS=new Set(['Object_6','Object_7','Object_14']);
 if(!markerMode)model.traverse((o:any)=>{
  if(!o.isMesh)return;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  let mode=0; // 0 = never tint, 1 = paint zones, 2 = glass above beltline, 3 = glass whole
  if(PAINT_OBJECTS.has(o.name))mode=1;else if(GLASS_OBJECTS.has(o.name))mode=2;else if(GLASS_FULL_OBJECTS.has(o.name))mode=3;else return;
  const clone=mats.map((m:any)=>{const c=m.clone();c.onBeforeCompile=(sh:any)=>{sh.uniforms.uZone={value:0};sh.uniforms.uGlow={value:0};sh.uniforms.uTime={value:0};sh.uniforms.uTint={value:new THREE.Color(0xf38a35)};sh.uniforms.uBuild={value:1};
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWPos=(modelMatrix*vec4(transformed,1.0)).xyz;');
   // zoneOf: illustrative panel zones on the painted shell only. Group
   // space, front is +x: impact ~ front 36% + mirror band; front half;
   // rest. Mirrors keep impact coverage.
   const zoneFn='\nfloat zoneOf(vec3 p){\n float az=abs(p.z);\n bool mirrorBand=p.x>-0.3&&p.x<0.9&&az>GZ*0.72&&p.y>GY*0.18;\n return (p.x>GX*0.36||mirrorBand)?1.0:(p.x>-0.12?2.0:3.0);\n}';
   const common='#include <common>\nvarying vec3 vWPos; uniform float uZone; uniform float uGlow; uniform float uTime; uniform vec3 uTint; uniform float uBuild;\nconst float GX='+gx.toFixed(4)+'; const float GY='+gy.toFixed(4)+'; const float GZ='+gz.toFixed(4)+';'+(mode===1?zoneFn:'');
   const hit=mode===1
    ?'float zoneHit=uZone>0.5&&uZone<3.5?(zoneOf(vWPos)<=uZone?1.0:0.0):0.0;\nfloat cov=zoneOf(vWPos);'+(layerBuild?'\nfloat sweep=(GX-vWPos.x)/(2.0*GX);zoneHit*=clamp((uBuild-sweep)*10.0,0.0,1.0);':'')
    :mode===2
    ?'float zoneHit=uZone>3.5&&vWPos.y>GY*0.12?1.0:0.0;\nfloat cov=99.0;'
    :'float zoneHit=uZone>3.5?1.0:0.0;\nfloat cov=99.0;';
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>',common).replace('#include <dithering_fragment>','#include <dithering_fragment>\n'+hit+'\nfloat pulse=0.72+0.28*sin(uTime*2.4+cov*3.0);\ngl_FragColor.rgb=mix(gl_FragColor.rgb,uTint,zoneHit*uGlow*0.33*pulse);\ngl_FragColor.rgb+=uTint*zoneHit*uGlow*0.12*pulse;');
   shaders.push(sh.uniforms as any)};return c});
  o.material=Array.isArray(o.material)?clone:clone[0];
 });
 // Recompute smooth vertex normals on the paint shells: the source GLB
 // carries hard shading seams (a visible rectangular shading patch on
 // the doors, heavy faceting through the tint) that are not intentional
 // panel gaps. Split vertices at identical positions are then re-averaged
 // so those seams disappear; creases at real position breaks stay sharp.
 const smoothSplitSeams=(o:any)=>{
  const g=o.geometry as THREE.BufferGeometry,posA=g.attributes.position as THREE.BufferAttribute,nA=g.attributes.normal as THREE.BufferAttribute;
  const byPos=new Map<string,number[]>();
  for(let i=0;i<posA.count;i++){const k=posA.getX(i).toFixed(4)+','+posA.getY(i).toFixed(4)+','+posA.getZ(i).toFixed(4);const l=byPos.get(k);if(l)l.push(i);else byPos.set(k,[i]);}
  for(const idxs of byPos.values()){
   if(idxs.length<2)continue;
   let x=0,y=0,z=0;for(const i of idxs){x+=nA.getX(i);y+=nA.getY(i);z+=nA.getZ(i);}
   const len=Math.hypot(x,y,z)||1;for(const i of idxs)nA.setXYZ(i,x/len,y/len,z/len);
  }
  nA.needsUpdate=true;
 };
 model.traverse((o:any)=>{if(o.isMesh&&PAINT_OBJECTS.has(o.name)){o.geometry.computeVertexNormals();smoothSplitSeams(o);}});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let zone=0,glowT=0,spin=false;
 let markerSet=0;
 const BUILD_MS=2200;
 let buildStart=-1e9,buildK=1;
 const render=(t=0)=>{const now=t||performance.now();if(layerBuild){const k=reduced?1:Math.min(1,Math.max(0,(now-buildStart)/BUILD_MS));buildK=k*k*(3-2*k)}for(const u of shaders){u.uTime.value=reduced?0:t/1000;u.uZone.value=zone;u.uGlow.value+=(glowT-u.uGlow.value)*0.18;if(Math.abs(u.uGlow.value-glowT)<.01)u.uGlow.value=glowT;if(layerBuild)u.uBuild.value=buildK}
  if(markerMode){markerSets.forEach((set,si)=>set.forEach((m,mi)=>{const on=si===markerSet;m.visible=on;if(on){const p=reduced?1:1+.18*Math.sin(t/280+mi*1.3);m.scale.setScalar(.34*p)}}))}
  renderer.render(scene,camera)};
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render()};new ResizeObserver(resize).observe(host);resize();host.classList.add('rover-ready');
 let frame=0;const loop=(t:number)=>{if(spin&&!reduced&&buildK>=1)group.rotation.y+=.004;render(t);frame=requestAnimationFrame(loop)};
 const setZone=(i:number)=>{if(markerMode){markerSet=i;zone=0;glowT=0;spin=false}else{zone=Number(chips[i]?.dataset.zoneLevel??[1,2,3][i]??3);glowT=zone>0?1:0;spin=zone===3;if(layerBuild&&zone>0)buildStart=performance.now()}cancelAnimationFrame(frame);const start=group.rotation.y,target=i===2?start:-.55,time=performance.now();const tick=(now:number)=>{const k=Math.min(1,(now-time)/650);group.rotation.y=start+(target-start)*(1-Math.pow(1-k,3));if(k<1){render(now);requestAnimationFrame(tick)}else{frame=requestAnimationFrame(loop)}};requestAnimationFrame(tick)};
 const scope=host.closest('.service-detail');
 const chips=[...(scope?.querySelectorAll<HTMLButtonElement>('[data-zone-chip]')??[])];
 const panels=[...(scope?.querySelectorAll<HTMLDetailsElement>('.service-options details')??[])];
 // Chips and option details stay in sync both ways; one open panel at a time.
 const activate=(i:number)=>{chips.forEach((c,j)=>c.setAttribute('aria-pressed',String(j===i)));panels.forEach((d,j)=>{d.open=j===i});setZone(i)};
 chips.forEach((b,i)=>b.addEventListener('click',()=>activate(i)));
 panels.forEach((d,i)=>d.addEventListener('toggle',()=>{if(d.open)activate(i)}));
 let touch:{x:number,y:number,angle:number,locked:boolean,id:number}|null=null;
 host.addEventListener('pointerdown',e=>{touch={x:e.clientX,y:e.clientY,angle:group.rotation.y,locked:false,id:e.pointerId}});
 host.addEventListener('pointermove',e=>{if(!touch||touch.id!==e.pointerId)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;if(!touch.locked){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){touch=null;return}if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.2)return;touch.locked=true;host.setPointerCapture(e.pointerId);host.classList.add('is-turning');spin=false;cancelAnimationFrame(frame);frame=requestAnimationFrame(loop)}group.rotation.y=touch.angle+dx*.009});
 host.addEventListener('pointerup',()=>{touch=null;host.classList.remove('is-turning')});host.addEventListener('pointercancel',()=>{touch=null;host.classList.remove('is-turning')});
 host.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();group.rotation.y+=(e.key==='ArrowLeft'?-.15:.15)});
 setZone(0);
}
