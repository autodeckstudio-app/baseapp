// Help: call, WhatsApp, location, hours and a short FAQ.
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { useLang } from "../../lib/i18n";
import { FAQ, STUDIO_INFO, formatHours } from "../../lib/studio-info";
import { getStudioInfo } from "../../lib/booking-service";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { Button, Kicker, Notice, Pane, Row, Screen, T } from "../../ui/kit";

export default function HelpScreen() {
  const router = useRouter();
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
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">{t("Help")}</Kicker><T role="title">{t("We are here")}</T></View>}>
      {hasContact ? (
        <View style={{ gap: space.breath }}>
          {s.phone ? <Button label={t("Call the studio")} onPress={() => void Linking.openURL(`tel:${s.phone}`)} /> : null}
          {s.whatsapp ? <Button kind="quiet" label={t("Message on WhatsApp")} onPress={() => void Linking.openURL(`https://wa.me/${s.whatsapp}`)} /> : null}
        </View>
      ) : (
        <Notice title="Contact details coming soon" body="Calling and messaging the studio will appear here." />
      )}
      {s.address || s.hours ? (
        <Pane pad="gap">
          {s.address ? <Row title="Studio" detail={s.address} {...(s.mapsUrl ? { onPress: () => void Linking.openURL(s.mapsUrl) } : {})} /> : null}
          {s.hours ? <Row title="Hours" detail={s.hours} last /> : null}
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
