const {chromium}=require('playwright-core'); const fs=require('fs');const assert=require('assert');
const url=require('node:url').pathToFileURL(require('node:path').join(__dirname,'index.html')).href;
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const results=[];try{
 for(const width of [390,320,1280]){
 const page=await browser.newPage({viewport:{width,height:900},isMobile:width<600,hasTouch:true,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url); await page.waitForSelector('[data-testid="garage-carousel"]');
 await page.getByRole('button',{name:'Kia',exact:true}).click();
 const scroll=page.getByTestId('garage-car-scroll'); await page.waitForFunction(()=>document.querySelector('[data-testid="garage-car-scroll"]').scrollWidth>document.querySelector('[data-testid="garage-car-scroll"]').clientWidth);
 assert.equal(await scroll.getByRole('button',{name:'Open Kia Seltos',exact:true}).count(),1);assert.equal(await scroll.getByRole('button',{name:'Open Kia Sonet',exact:true}).count(),1);assert.equal(await scroll.getByRole('button',{name:'Open BMW X1',exact:true}).count(),0);
 const bounds=await scroll.boundingBox(),cdp=await page.context().newCDPSession(page);const y=bounds.y+45,x1=bounds.x+Math.min(bounds.width-20,300),x2=bounds.x+20;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y}]});for(let n=1;n<=12;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*n/12,y}]});await page.waitForTimeout(15)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>document.body.innerText.includes('2 / 2'),null,{timeout:4000});
 await page.waitForTimeout(700);const after=await scroll.evaluate(e=>({left:e.scrollLeft,width:e.clientWidth,extent:e.scrollWidth})); assert(after.left>100);assert.equal(await page.locator('[aria-modal="true"]').count(),0);
 await page.screenshot({path:`/downloads/autodeck-garage-kia-touch-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Previous car',exact:true}).click(); await page.waitForFunction(()=>document.body.innerText.includes('1 / 2'));
 await page.getByRole('button',{name:'Next car',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.innerText.includes('2 / 2'));
 await page.getByRole('button',{name:'Open Kia Sonet',exact:true}).click();await page.getByRole('button',{name:'Close car preview',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.body.dataset.activeCar),'B');await page.getByRole('button',{name:'Close car preview',exact:true}).click();
 await page.getByRole('button',{name:'BMW',exact:true}).click();await scroll.getByRole('button',{name:'Open BMW X1',exact:true}).waitFor();assert.equal(await scroll.getByRole('button',{name:'Open BMW X1',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Next car',exact:true}).count(),0);
 await page.getByRole('button',{name:'All',exact:true}).click();await page.waitForFunction(()=>document.body.innerText.includes('1 / 3'));
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow);assert.deepEqual(errors,[]);results.push({width,brandIncludesBothModels:true,touchSwipe:after,keyboardNext:true,cardTapPreview:true,brandChangeResets:true,AllRestored:true,noPageOverflow:true,errors});await page.close();
 }
 for(const light of [false,true])for(const visits of [0,1,3,10]){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto(url+`?story&visits=${visits}`+(light?'&light':''));await page.waitForSelector('[data-testid="car-story-achievements"]');await page.waitForTimeout(100);await page.screenshot({path:`/downloads/autodeck-story-${visits}-${light?'day':'night'}-390.png`,fullPage:true});const bar=page.getByTestId('car-story-progress-fill');const w1=await bar.evaluate(e=>e.getBoundingClientRect().width);await page.waitForTimeout(250);const w2=await bar.evaluate(e=>e.getBoundingClientRect().width);assert.equal(w1,w2);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));results.push({storyVisits:visits,light,reducedMotionStable:true,fillWidth:w2,noPageOverflow:true});await page.close();
 }
 const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'no-preference'});await p.goto(url+'?story&visits=1');await p.waitForSelector('[data-testid="car-story-progress-fill"]');const w0=await p.getByTestId('car-story-progress-fill').evaluate(e=>e.getBoundingClientRect().width);await p.waitForTimeout(750);const w1=await p.getByTestId('car-story-progress-fill').evaluate(e=>e.getBoundingClientRect().width);assert(w1>w0);await p.screenshot({path:'/downloads/autodeck-story-1-night-1280.png',fullPage:true});results.push({normalMotionAnimates:true,startWidth:w0,endWidth:w1});
 fs.writeFileSync('/downloads/autodeck-correction-browser-proof.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
