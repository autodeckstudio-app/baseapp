// INACTIVE full-connection candidate. Replace Code only after exact rollout approval.
// No source-cell read/write permission is added to this Apps Script.
const PANEL_ACTIVE = false;
function onOpen() { SpreadsheetApp.getUi().createMenu('AutoDeck').addItem('Price draft', 'openPriceDraft').addToUi(); }
function openPriceDraft() { assertPilotWorkbook(); SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Panel').setTitle('AutoDeck price draft')); }
// Container verified through the actual Price List Extensions menu. No cell-read scope.
const PILOT_SCRIPT_ID = '1gWWRlSMuaGWVH45GtG47Ze8W_Y0u7Xtp3dmxQTULXaPs-OjjRtfqReR4';
function assertPilotWorkbook(){if(ScriptApp.getScriptId()!==PILOT_SCRIPT_ID)throw new Error('Reviewed Price List bound script required');}
function panelRequest(request) {
  assertPilotWorkbook();
  if (!PANEL_ACTIVE) throw new Error('Panel is not activated. Nothing changed.');
  const endpoint = 'https://asia-south1-autodeck-studio.cloudfunctions.net/catalogueSheetPanelBridge';
  if (!endpoint || !/^https:\/\/asia-south1-autodeck-studio\.cloudfunctions\.net\/catalogueSheetPanelBridge$/.test(endpoint)) throw new Error('Reviewed AutoDeck endpoint required');
  if (!request || !['read', 'save', 'status', 'list', 'source-preview', 'source-stage', 'source-status'].includes(request.operation)) throw new Error('Known operation required');
  const identity = ScriptApp.getIdentityToken();
  if (!identity) throw new Error('Google identity unavailable');
  const response = UrlFetchApp.fetch(endpoint, {method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+identity},payload:JSON.stringify(request),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Draft not confirmed. Check status before trying another save.');
  return JSON.parse(response.getContentText());
}
function panelServices(){assertPilotWorkbook();return panelRequest({operation:'list'});}

function inspectIdentityAudience(){assertPilotWorkbook();const token=ScriptApp.getIdentityToken();if(!token)throw new Error('Identity unavailable');const payload=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());console.log(JSON.stringify({audience:payload.aud,emailVerified:payload.email_verified,businessIdentity:payload.email==='autodeckstudio@gmail.com'}));}
