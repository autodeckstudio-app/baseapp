// "Garage Light" palette for the customer app: warm off-white by day, flat charcoal by night, one orange.
// The phone setting and the clock choose between them (see the root layout). Imported first in the root
// layout so the tokens are in place before any screen module reads them.
import { applyCustomerGarage } from "@autodeck/ui/tokens";
import { applyCustomerGarageTheme, applyCustomerGarageGlass, applyCustomerGarageScale } from "@autodeck/ui/theme";

applyCustomerGarage();
applyCustomerGarageTheme();
applyCustomerGarageGlass();
applyCustomerGarageScale();
import { radius as tokenRadius } from "@autodeck/ui/tokens";
Object.assign(tokenRadius as unknown as Record<string, number>, { sm: 12, md: 12, lg: 20, xl: 20 });
