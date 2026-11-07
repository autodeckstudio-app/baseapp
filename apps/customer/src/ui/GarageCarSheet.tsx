// Garage car preview pop-up: tapping a stacked card opens this sheet with the
// car's photo, details, documents and service history. Tapping outside the
// sheet (or the close control) dismisses it. "Open full details" leads to the
// full car room, where editing lives.
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { segmentLabel } from "@autodeck/core";
import type { ServiceJob, Vehicle } from "@autodeck/core";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Plate } from "./kit";
import { CarThumb } from "./CarThumb";
import { HistoryVisitRow } from "./HistoryVisitRow";
import { daysUntil, type MyPaper } from "../lib/paper-service";
import { paperName } from "../lib/documents";
import { visitServices, visitTitle } from "../lib/visit-services";

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function expiryLine(p: MyPaper): string {
  if (!p.expiresOn) return "No expiry date";
  const d = daysUntil(p.expiresOn);
  if (d === null) return `Expires ${fmtDay(p.expiresOn)}`;
  if (d < 0) return `Expired ${fmtDay(p.expiresOn)}`;
  if (d === 0) return "Expires today";
  if (d <= 30) return `Expires in ${d} day${d === 1 ? "" : "s"}`;
  return `Valid till ${fmtDay(p.expiresOn)}`;
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={{ color: "#EC8638", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>{children.toUpperCase()}</Text>;
}

export function GarageCarSheet({ car, onClose, onOpenRoom, jobs, svcNames, papers }: {
  car: Vehicle | null;
  onClose: () => void;
  onOpenRoom: (v: Vehicle) => void;
  jobs: ServiceJob[];
  svcNames: Record<string, string>;
  papers: MyPaper[] | null; // null = still loading
}) {
  const { colors: ink, name: themeName } = useExperienceTheme();
  const { height: winH, width: winW } = useWindowDimensions();
  if (!car) return null;
  const light = themeName === "light";
  const name = `${car.make ?? ""} ${car.model ?? ""}`.trim() || car.registrationNumber;
  const visits = jobs
    .filter((j) => j.vehicleId === car.id)
    .sort((a, b) => (b.sealedAt ?? b.createdAt).localeCompare(a.sealedAt ?? a.createdAt))
    .slice(0, 4);
  const details: Array<[string, string]> = ([
    car.year ? ["Year", String(car.year)] : null,
    car.color ? ["Colour", car.color] : null,
    car.odometer != null ? ["Odometer", `${Number(car.odometer).toLocaleString("en-IN")} km`] : null,
  ] as Array<[string, string] | null>).filter((d): d is [string, string] => d !== null);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="Close car preview" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(10,10,14,0.55)", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <View onStartShouldSetResponder={() => true} style={{ width: Math.min(winW - 32, 480), maxHeight: Math.round(winH * 0.86), borderRadius: 24, overflow: "hidden", backgroundColor: light ? "#F6F4F1" : "#17171C", borderWidth: 1, borderColor: "rgba(180,180,190,0.25)" }}>
          <ScrollView bounces={false}>
            <CarThumb car={car} height={200} radius={0} />
            <View style={{ padding: 18, gap: 16 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ color: ink.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }}>{name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Plate value={car.registrationNumber} />
                  {segmentLabel(car.category) ? <Text style={{ color: ink.textSecondary, fontSize: 12 }}>{segmentLabel(car.category)}</Text> : null}
                </View>
              </View>
              {details.length ? (
                <View style={{ gap: 8 }}>
                  <SectionLabel>Details</SectionLabel>
                  {details.map(([k, v]) => (
                    <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <Text style={{ color: ink.textSecondary, fontSize: 13 }}>{k}</Text>
                      <Text style={{ color: ink.textPrimary, fontSize: 13, fontWeight: "700" }}>{v}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={{ gap: 8 }}>
                <SectionLabel>Documents</SectionLabel>
                {papers === null ? (
                  <Text style={{ color: ink.textSecondary, fontSize: 13 }}>Loading documents...</Text>
                ) : papers.length === 0 ? (
                  <Text style={{ color: ink.textSecondary, fontSize: 13 }}>No documents added yet.</Text>
                ) : (
                  papers.map((p) => (
                    <View key={p.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ color: ink.textPrimary, fontSize: 14, fontWeight: "700" }}>{paperName(p)}</Text>
                        <Text numberOfLines={1} style={{ color: ink.textSecondary, fontSize: 12 }}>{p.reference}</Text>
                      </View>
                      <Text style={{ color: ink.textSecondary, fontSize: 12 }}>{expiryLine(p)}</Text>
                    </View>
                  ))
                )}
              </View>
              <View style={{ gap: 4 }}>
                <SectionLabel>Service history</SectionLabel>
                {visits.length === 0 ? (
                  <Text style={{ color: ink.textSecondary, fontSize: 13, paddingVertical: 6 }}>No visits yet.</Text>
                ) : (
                  visits.map((job, i) => (
                    <HistoryVisitRow
                      key={job.id}
                      at={job.sealedAt ?? job.createdAt}
                      title={visitTitle(visitServices(job, null, svcNames))}
                      caption={fmtDay(job.sealedAt ?? job.createdAt)}
                      status={job.status}
                      first={i === 0}
                    />
                  ))
                )}
              </View>
              <Button label="Open full details" kind="quiet" onPress={() => onOpenRoom(car)} />
            </View>
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 9999, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>×</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
