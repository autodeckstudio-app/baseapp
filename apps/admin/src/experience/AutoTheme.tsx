// Automatic day/night for the admin app. Night when the device prefers dark
// mode or the local clock is outside 6 AM to 7 PM. Runs before first paint
// (no flash), then re-checks every 30 seconds and when the device setting
// changes. There is no manual toggle.
const SCRIPT = `(function(){
  var d=document.documentElement;
  function night(){var h=new Date().getHours();var dark=false;try{dark=window.matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}return dark||h<${6}||h>=${19}}
  function apply(){var n=night();d.setAttribute("data-theme",n?"night":"light");d.style.colorScheme=n?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",n?"#50504D":"#F3EEFB");}
  apply();
  setInterval(apply,30000);
  document.addEventListener("visibilitychange",apply);
  try{window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",apply)}catch(e){}
})();`;

export function AutoThemeScript() {
  return <script id="autodeck-auto-theme" dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
