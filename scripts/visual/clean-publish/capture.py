import subprocess,time,json,urllib.request,websocket,base64,pathlib
out=pathlib.Path('/downloads/ad-clean-publish-preview');server=subprocess.Popen(['python','-m','http.server','8147','--directory',str(out)],stdout=open('/tmp/ad-clean-server.log','w'),stderr=subprocess.STDOUT);chrome=subprocess.Popen(['/usr/bin/google-chrome','--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=9247','--remote-allow-origins=*','--user-data-dir=/tmp/ad-clean-chrome','about:blank'],stdout=open('/tmp/ad-clean-chrome.log','w'),stderr=subprocess.STDOUT)
try:
 for n in range(70):
  try:tabs=json.load(urllib.request.urlopen('http://127.0.0.1:9247/json'));break
  except:time.sleep(.1)
 ws=websocket.create_connection(tabs[0]['webSocketDebuggerUrl']);seq=0
 def cmd(method,params={}):
  global seq;seq+=1;ws.send(json.dumps({'id':seq,'method':method,'params':params}))
  while True:
   x=json.loads(ws.recv())
   if x.get('method')=='Runtime.consoleAPICalled':print('CONSOLE',x['params']['args'])
   if x.get('method')=='Runtime.exceptionThrown':print('JS ERROR',str(x)[:1000])
   if x.get('id')==seq:return x.get('result',{})
 def ev(s):return cmd('Runtime.evaluate',{'expression':s,'returnByValue':True}).get('result',{}).get('value')
 def shot(name):(out/(name+'.png')).write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})['data']))
 def click(label):
  ok=ev('(()=>{const e=[...document.querySelectorAll("button,summary")].find(e=>e.textContent.trim()==='+json.dumps(label)+');if(!e)return false;e.click();return true})()');assert ok,label;time.sleep(.25)
 def text():return ev('document.body.innerText')
 cmd('Page.enable');cmd('Runtime.enable')
 for width,height,mode in [(1180,960,'desktop'),(390,844,'mobile')]:
  cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False});cmd('Page.navigate',{'url':'http://127.0.0.1:8147/index.html'});time.sleep(.5);ev('localStorage.clear();sessionStorage.clear()');cmd('Page.reload');time.sleep(.4)
  shot('clean-entry-'+mode);click('Washing');click('Edit');
  print('Editor inputs',ev('[...document.querySelectorAll("input")].map(e=>[e.type,e.value,e.placeholder])'))
  ok=ev('(()=>{const e=[...document.querySelectorAll("input")].find(e=>e.value==="600");if(!e)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"650");e.dispatchEvent(new Event("input",{bubbles:true}));return true})()');assert ok,text()[-2000:]
  click('Save changes');assert '1 unpublished change' in text(),text()[-1000:];ev('document.querySelector(".ax-main").scrollTop=999999');time.sleep(.2);shot('clean-saved-'+mode);cmd('Page.reload');time.sleep(.5);assert '1 unpublished change' in text();ev('document.querySelector(".ax-main").scrollTop=999999');click('Review changes');assert 'Price: ₹600 → ₹650' in text();assert 'Other changed details' not in ev('document.querySelector("[role=dialog]").innerText');assert ev('document.querySelectorAll("[role=dialog] input[type=checkbox]").length')==1;assert ev('document.querySelector("[role=dialog]").innerText.includes("Earlier saved")')==False;shot('clean-review-'+mode)
  print(mode,'widths',ev('[innerWidth,document.body.scrollWidth]'),'dialog',ev('document.querySelector("[role=dialog]").innerText'))
  click('Publish');assert 'Publish not confirmed' in text();assert 'Check status' in text();ev('document.querySelector(".ax-main").scrollTop=999999');time.sleep(.2);shot('clean-unknown-'+mode)
finally:
 chrome.terminate();chrome.wait();server.terminate();server.wait()
