import{PRICE_SOURCE_ACTIVE,activePriceSourceMapping}from'./price-list-activation.js';
// Separate reviewed activation required. Not an environment-only switch.
export const CATALOGUE_PANEL_QUALIFIED=true;
export const PANEL_PILOT_SERVICE_ID='svc_a68025c3e10bfbe17ef6560ded766f18';
export function panelServiceIds(){return PRICE_SOURCE_ACTIVE?activePriceSourceMapping().bindings.filter(b=>b.policy==='fixed').map(b=>b.serviceId):CATALOGUE_PANEL_QUALIFIED?[PANEL_PILOT_SERVICE_ID]:[];}
