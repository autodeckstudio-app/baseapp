// Separate reviewed activation required. Not an environment-only switch.
export const CATALOGUE_PANEL_QUALIFIED=true;
export const PANEL_PILOT_SERVICE_ID='svc_a68025c3e10bfbe17ef6560ded766f18';
export function panelServiceIds(){return CATALOGUE_PANEL_QUALIFIED?[PANEL_PILOT_SERVICE_ID]:[];}
