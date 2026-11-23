import type{Service}from'./types/service';
/** Price remains a price. Non-online catalogue work cannot reserve a bay. */
export function serviceOnlineBookingIssue(s:Pick<Service,'customerMenu'>):'walk_in_only'|'coordination_required'|null{return s.customerMenu?.bookingMode==='walk_in'?'walk_in_only':s.customerMenu?.bookingMode==='coordination'?'coordination_required':null}
