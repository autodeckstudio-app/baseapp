// Emits the theme's CSS custom properties from the TS tokens, so the web
// stylesheet and the native primitives read one source of truth.
import { themeStylesheet } from "@autodeck/ui/theme";

export function ThemeStyle() {
  return <style id="autodeck-theme" dangerouslySetInnerHTML={{ __html: themeStylesheet() }} />;
}
