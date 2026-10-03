import { iconInner, iconMarkup, type IconName } from "@autodeck/ui/theme";

export function Icon({ name, size = 20, color = "currentColor" }: { name: IconName; size?: number; color?: string }) {
  void iconMarkup;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: iconInner(name) }} />
  );
}
