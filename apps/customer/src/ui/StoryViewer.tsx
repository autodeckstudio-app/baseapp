// Full-screen story player: progress bars, tap right/left to move, auto-advance, close at the top.
// Photos run 5 seconds. Videos play inline on web and advance when they end.
import { createElement, useEffect, useState } from "react";
import { Image, Modal, Platform, Pressable, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import type { StoryGroup } from "../lib/story-service";
import { T } from "./kit";

const PHOTO_MS = 5000;

export function StoryViewer({ group, onClose }: { group: StoryGroup | null; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => { setI(0); setTick(0); }, [group?.key]);
  const item = group?.items[i];
  const isVideo = item?.mediaType === "video";
  const next = () => (group && i < group.items.length - 1 ? (setI(i + 1), setTick(0)) : onClose());
  const prev = () => (i > 0 ? (setI(i - 1), setTick(0)) : setTick(0));

  useEffect(() => {
    if (!group || !item || isVideo) return;
    const t = setTimeout(next, PHOTO_MS);
    const raf = setInterval(() => setTick((x) => x + 100), 100);
    return () => { clearTimeout(t); clearInterval(raf); };
  }, [group?.key, i]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!group || !item) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#0B0A10", alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: 480 }}>
          {isVideo && Platform.OS === "web" ? (
            createElement("video", { key: item.id, src: item.url, autoPlay: true, playsInline: true, onEnded: next, style: { position: "absolute", width: "100%", height: "100%", objectFit: "contain", background: "#000" } })
          ) : (
            <Image source={{ uri: item.url }} resizeMode="contain" style={{ position: "absolute", width: "100%", height: "100%" }} />
          )}
          <View style={{ position: "absolute", top: 14, left: 12, right: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {group.items.map((s, n) => (
                <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
                  <View style={{ height: 3, backgroundColor: "#fff", width: n < i ? "100%" : n === i && !isVideo ? `${Math.min(100, (tick / PHOTO_MS) * 100)}%` : n === i ? "100%" : "0%" }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T role="bodyStrong" style={{ color: "#fff" }}>{group.title}</T>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
                <Icon name="close" color="#FFFFFF" size={26} />
              </Pressable>
            </View>
          </View>
          <View style={{ position: "absolute", top: 80, bottom: 90, left: 0, right: 0, flexDirection: "row" }}>
            <Pressable accessibilityLabel="Previous" onPress={prev} style={{ flex: 1 }} />
            <Pressable accessibilityLabel="Next" onPress={next} style={{ flex: 2 }} />
          </View>
          {item.caption ? (
            <View style={{ position: "absolute", left: 16, right: 16, bottom: 36 }}>
              <T style={{ color: "#fff", textAlign: "center" }}>{item.caption}</T>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
