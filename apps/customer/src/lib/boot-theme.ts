// Customer "Raised" palette: soft grey by day, deep charcoal by night, the one AutoDeck orange.
// Imported first in the root layout so it is in place before any screen module reads colour tokens.
import { applyCustomerRaised } from "@autodeck/ui/tokens";
import { applyCustomerRaisedTheme } from "@autodeck/ui/theme";

applyCustomerRaised();
applyCustomerRaisedTheme();
