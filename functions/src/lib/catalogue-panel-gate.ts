// Separate reviewed activation required. Not an environment-only switch.
export const CATALOGUE_PANEL_QUALIFIED=false;
export const PANEL_PILOT_SERVICE_ID='svc-wash-regular';
export function panelServiceIds(){return CATALOGUE_PANEL_QUALIFIED?[PANEL_PILOT_SERVICE_ID]:[];}
