// Admin is white theme only. Pins the light theme before first paint.
const SCRIPT = `(function(){
  var d=document.documentElement;
  d.setAttribute("data-theme","light");d.style.colorScheme="light";
  var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#F3EEFB");
})();`;

export function AutoThemeScript() {
  return <script id="autodeck-auto-theme" dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
