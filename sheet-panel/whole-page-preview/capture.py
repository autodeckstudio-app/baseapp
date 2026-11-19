import subprocess,time,json,urllib.request,websocket,base64,pathlib
out=pathlib.Path('/tmp/ad-price-whole-preview')
server=subprocess.Popen(['python','-m','http.server','8124','--bind','127.0.0.1'],cwd=out,stdout=open(out/'server.log','w'),stderr=subprocess.STDOUT)
chrome=subprocess.Popen(['google-chrome','--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-allow-origins=*','--remote-debugging-port=9235','--user-data-dir=/tmp/ad-price-whole-profile','about:blank'],stdout=open(out/'chrome.log','w'),stderr=subprocess.STDOUT)
try:
 for i in range(50):
  try:tabs=json.load(urllib.request.urlopen('http://127.0.0.1:9235/json'));break
  except:time.sleep(.1)
 ws=websocket.create_connection(next(t['webSocketDebuggerUrl']for t in tabs if t['type']=='page'));n=0
 def cmd(method,params={}):
  global n;n+=1;ws.send(json.dumps({'id':n,'method':method,'params':params}))
  while True:
   d=json.loads(ws.recv())
   if d.get('id')==n:
    if 'error'in d:raise Exception(d)
    return d.get('result',{})
 def js(expression):
  r=cmd('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})
  if 'exceptionDetails'in r:raise Exception(r)
  return r.get('result',{}).get('value')
 def shot(name):
  data=cmd('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})['data'];(out/name).write_bytes(base64.b64decode(data))
 results=[]
 for width,height in [(1280,1024),(390,844)]:
  cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<500})
  cmd('Page.navigate',{'url':'http://127.0.0.1:8124/admin.html'});time.sleep(.65)
  shot('whole-admin-'+str(width)+'.png')
  js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Washing').click()");time.sleep(.1)
  shot('whole-washing-'+str(width)+'.png')
  js("[...document.querySelectorAll('.ax-svc-card')].find(e=>e.textContent.includes('Vacuum & Polish')).querySelector('button').click()");time.sleep(.1)
  shot('whole-editor-'+str(width)+'.png')
  js("[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Close').click()") if js("!![...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Close')") else None
  cmd('Page.navigate',{'url':'http://127.0.0.1:8124/admin.html'});time.sleep(.4)
  js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Review changes').click()");time.sleep(.25)
  results.append({'adminWidth':width,'gateDisabled':js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Publish').disabled"),'horizontalOverflow':js('document.documentElement.scrollWidth>innerWidth')})
  shot('admin-'+str(width)+'.png')
  js("document.querySelector('[aria-label=\"Actual Price List update\"] input').click()")
  assert js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Publish').disabled") is False
  js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Publish').click()")
  assert js('!!window.previewPublished') is True
 cmd('Emulation.setDeviceMetricsOverride',{'width':1280,'height':960,'deviceScaleFactor':1,'mobile':False})
 cmd('Page.navigate',{'url':'http://127.0.0.1:8124/sheet-context.html'});time.sleep(.3)
 js("document.querySelector('iframe').contentDocument.getElementById('source-review').click()");time.sleep(.1)
 shot('sheet-context-1280.png')
 cmd('Emulation.setDeviceMetricsOverride',{'width':320,'height':900,'deviceScaleFactor':1,'mobile':False})
 cmd('Page.navigate',{'url':'http://127.0.0.1:8124/sidebar.html'});time.sleep(.4)
 js("document.getElementById('source-review').click()");time.sleep(.2);shot('sidebar-320.png')
 results.append({'sidebarOverflow':js('document.documentElement.scrollWidth>innerWidth'),'inspectionDisabled':js("document.querySelector('option[value=inspection]').disabled")})
 js("document.getElementById('source-stage').click()");time.sleep(.2)
 assert 'confirmed' in js("document.getElementById('source-status').textContent")
 results.append({'sidebarCalls':js('fixtureCalls')})
 (out/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
finally:
 chrome.terminate();server.terminate();chrome.wait();server.wait()
