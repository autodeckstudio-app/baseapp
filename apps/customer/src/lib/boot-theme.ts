// One near-black, orange-accent palette for the whole customer app. Imported first in the root layout
// so it is in place before any screen module reads the colour tokens.
import { applyCustomerDark } from "@autodeck/ui/tokens";
import { applyCustomerDarkTheme } from "@autodeck/ui/theme";

applyCustomerDark();
applyCustomerDarkTheme();
