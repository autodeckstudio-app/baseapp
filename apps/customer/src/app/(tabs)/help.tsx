// Help: call, WhatsApp, location, hours and a short FAQ.
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "../../ui/NavIcon";
import { useLang } from "../../lib/i18n";
import { FAQ, STUDIO_INFO, formatHours } from "../../lib/studio-info";
import { getStudioInfo } from "../../lib/booking-service";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { Kicker, Notice, Pane, Row, Screen, T } from "../../ui/kit";

export default function HelpScreen() {
  const { colors, name } = useExperienceTheme();
  const cut = name === "light" ? "#FFFFFF" : "#18181C";
  const { t } = useLang();
  const [open, setOpen] = useState<number | null>(null);
  const [liveHours, setLiveHours] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getStudioInfo(FIRST_STUDIO_ID).then((i) => { if (alive && i.operatingHours?.length) setLiveHours(formatHours(i.operatingHours)); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const s = { ...STUDIO_INFO, hours: liveHours ?? STUDIO_INFO.hours };
  const hasContact = Boolean(s.phone || s.whatsapp);
  return (
    <Screen>
      {hasContact ? (
        <Pane pad="gap">
          {s.phone ? <Row title={t("Call the studio")} detail={s.hours || undefined} trailing={<NavIcon name="call" color={colors.textPrimary} size={22} cut={cut} />} onPress={() => void Linking.openURL(`tel:${s.phone}`)} last={!s.whatsapp} /> : null}
          {s.whatsapp ? <Row title="WhatsApp" detail="Message the studio" trailing={<NavIcon name="whatsapp" color={colors.textPrimary} size={22} cut={cut} />} onPress={() => void Linking.openURL(`https://wa.me/${s.whatsapp}`)} last /> : null}
        </Pane>
      ) : (
        <Notice title="Contact details coming soon" body="Calling and messaging the studio will appear here." />
      )}
      {s.address ? (
        <Pane pad="gap">
          {s.address ? <Row title="Studio" detail={s.address} last {...(s.mapsUrl ? { onPress: () => void Linking.openURL(s.mapsUrl) } : {})} /> : null}
          
        </Pane>
      ) : null}
      <Kicker>{t("Questions")}</Kicker>
      <Pane pad="gap">
        {FAQ.map((f, i) => (
          <View key={f.q}>
            <Row title={f.q} onPress={() => setOpen(open === i ? null : i)} last={i === FAQ.length - 1 && open !== i} />
            {open === i ? <View style={{ paddingHorizontal: space.line, paddingBottom: space.line }}><T tone="secondary">{f.a}</T></View> : null}
          </View>
        ))}
      </Pane>
    </Screen>
  );
}
