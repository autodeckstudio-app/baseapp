// Local candidate only. Do not install, deploy, authorize or change Sheet access
// without the reviewed activation gate. No spreadsheet write method is used.
const PANEL_ACTIVE = false;
function onOpen() { SpreadsheetApp.getUi().createMenu('AutoDeck').addItem('Price draft', 'openPriceDraft').addToUi(); }
function openPriceDraft() { assertPilotWorkbook(); SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Panel').setTitle('AutoDeck price draft')); }
const PILOT_WORKBOOK_ID = '15K6LY_sbDF_6UNEqg1rycqxnuyd5lvPCH7pk17deol0';
function assertPilotWorkbook(){if(SpreadsheetApp.getActiveSpreadsheet().getId()!==PILOT_WORKBOOK_ID)throw new Error('Reviewed Price List workbook required');}
function panelRequest(request) {
  assertPilotWorkbook();
  if (!PANEL_ACTIVE) throw new Error('Panel is not activated. Nothing changed.');
  const props = PropertiesService.getScriptProperties();
  const endpoint = props.getProperty('PANEL_ENDPOINT');
  if (!endpoint || !/^https:\/\/asia-south1-autodeck-studio\.cloudfunctions\.net\/catalogueSheetPanelBridge$/.test(endpoint)) throw new Error('Reviewed AutoDeck endpoint required');
  if (!request || !['read', 'save', 'status'].includes(request.operation)) throw new Error('Known operation required');
  const identity = ScriptApp.getIdentityToken();
  if (!identity) throw new Error('Google identity unavailable');
  const response = UrlFetchApp.fetch(endpoint, {method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+identity},payload:JSON.stringify(request),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Draft not confirmed. Check status before trying another save.');
  return JSON.parse(response.getContentText());
}
function panelServices(){assertPilotWorkbook();return [{id:'svc-wash-regular',name:'Regular Wash'}];}
