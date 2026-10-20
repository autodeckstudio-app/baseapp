// Full-screen story player, Instagram style: progress bars, tap right or left, hold to pause, swipe down to close,
// and it moves on to the next circle when one ends. Photos run 5 seconds; videos play inline on web and advance when they end.
import { createElement, useEffect, useRef, useState } from "react";
import { Image, Modal, Platform, Pressable, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import type { StoryGroup } from "../lib/story-service";
import { storyAge } from "../lib/story-groups";
import { T } from "./kit";

const PHOTO_MS = 5000;

export function StoryViewer({ group, onClose, onNextGroup, onPrevGroup }: { group: StoryGroup | null; onClose: () => void; onNextGroup?: () => void; onPrevGroup?: () => void }) {
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchY = useRef<number | null>(null);
  useEffect(() => { setI(0); setTick(0); setPaused(false); }, [group?.key]);
  const item = group?.items[i];
  const isVideo = item?.mediaType === "video";
  const last = !!group && i >= group.items.length - 1;
  const next = () => { if (!group) return; if (!last) { setI(i + 1); setTick(0); } else if (onNextGroup) onNextGroup(); else onClose(); };
  const prev = () => { if (i > 0) { setI(i - 1); setTick(0); } else if (onPrevGroup && tick < 800) onPrevGroup(); else setTick(0); };

  useEffect(() => {
    if (!group || !item || isVideo || paused) return;
    const t = setInterval(() => setTick((x) => x + 100), 100);
    return () => clearInterval(t);
  }, [group?.key, i, paused, isVideo]);
  useEffect(() => { if (!isVideo && tick >= PHOTO_MS) next(); }, [tick]);

  if (!group || !item) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{ flex: 1, backgroundColor: "#0B0A10", alignItems: "center" }}
        onTouchStart={(e) => { touchY.current = e.nativeEvent.pageY; }}
        onTouchEnd={(e) => { if (touchY.current !== null && e.nativeEvent.pageY - touchY.current > 90) onClose(); touchY.current = null; }}
      >
        <View style={{ flex: 1, width: "100%", maxWidth: 480 }}>
          {isVideo && Platform.OS === "web" ? (
            createElement("video", { key: item.id, src: item.url, autoPlay: true, playsInline: true, onEnded: next, ref: (el: { pause(): void; play(): Promise<void> } | null) => { if (el) { if (paused) el.pause(); else void el.play().catch(() => undefined); } }, style: { position: "absolute", width: "100%", height: "100%", objectFit: "contain", background: "#000" } })
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                  {group.cover ? <Image source={{ uri: group.cover }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <T role="caption" style={{ color: "#fff" }}>{(group.title.trim()[0] ?? "H").toUpperCase()}</T>}
                </View>
                <T role="bodyStrong" style={{ color: "#fff" }}>{group.title}</T>
                <T role="caption" style={{ color: "rgba(255,255,255,0.7)" }}>{storyAge(item.createdAt)}</T>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
                <Icon name="close" color="#FFFFFF" size={26} />
              </Pressable>
            </View>
          </View>
          <View style={{ position: "absolute", top: 80, bottom: 90, left: 0, right: 0, flexDirection: "row" }}>
            <Pressable accessibilityLabel="Previous" onPress={prev} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} style={{ flex: 1 }} />
            <Pressable accessibilityLabel="Next" onPress={next} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} style={{ flex: 2 }} />
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
