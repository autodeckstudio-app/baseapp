import { DUO_VIEWBOX, duotoneInner, iconInner, iconMarkup, type IconName } from "@autodeck/ui/theme";

export function Icon({ name, size = 20, color = "currentColor", uid = "" }: { name: IconName; size?: number; color?: string; uid?: string }) {
  const inner = (n: IconName) => (uid ? iconInner(n).split(`#m${n}`).join(`#m${n}${uid}`).split(`id="m${n}"`).join(`id="m${n}${uid}"`) : iconInner(n));
  void iconMarkup;
  if (duotoneInner(name)) return <svg aria-hidden="true" width={size} height={size} viewBox={DUO_VIEWBOX} dangerouslySetInnerHTML={{ __html: inner(name) }} />;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: inner(name) }} />
  );
}
