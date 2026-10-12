// "Garage Light" palette for the studio app, shared with the customer app: warm off-white by day, flat charcoal by night, one orange.
import { applyCustomerGarage } from "@autodeck/ui/tokens";
import { applyCustomerGarageTheme, applyCustomerGarageGlass, applyCustomerGarageScale } from "@autodeck/ui/theme";

applyCustomerGarage();
applyCustomerGarageTheme();
applyCustomerGarageGlass();
applyCustomerGarageScale();
import { radius as tokenRadius } from "@autodeck/ui/tokens";
Object.assign(tokenRadius as unknown as Record<string, number>, { sm: 12, md: 12, lg: 20, xl: 20 });
