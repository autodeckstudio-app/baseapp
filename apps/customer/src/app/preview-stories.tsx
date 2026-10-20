// Dev-only: the story tray and viewer with sample pictures (no network, no sign-in).
import { useState } from "react";
import { View } from "react-native";
import type { StoryView } from "@autodeck/core";
import { StoryCircles } from "../ui/StoryCircles";
import { StoryViewer } from "../ui/StoryViewer";
import { Screen, T } from "../ui/kit";
import { groupStories, seenKeyOf, type StoryGroup } from "../lib/story-groups";

const PAL = ["#3B5B7A", "#7A4B3B", "#4B6B4B", "#6B4B7A", "#7A6B3B"];
const art = (n: number) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640"><rect width="360" height="640" fill="${PAL[n % 5]}"/><text x="180" y="330" font-size="28" fill="#fff" text-anchor="middle" font-family="sans-serif">Sample ${n}</text></svg>`)}`;
const now = Date.now();
const S = (n: number, hoursAgo: number, title: string | null, caption: string | null): StoryView => ({ id: String(n), mediaType: "image", url: art(n), caption, pinned: title !== null, highlightTitle: title, hidden: false, createdAt: new Date(now - hoursAgo * 3600e3).toISOString(), expiresAt: new Date(now - hoursAgo * 3600e3 + 24 * 3600e3).toISOString() });
const LIST = [S(1, 2, null, "Ceramic coat delivery"), S(2, 30, "Ceramic", "Gtechniq on a Thar"), S(3, 50, "Ceramic", null), S(4, 90, "PPF", "Full body PPF"), S(5, 120, "Washing", "Foam wash")];

export default function PreviewStories() {
  if (!__DEV__) return null;
  const groups = groupStories(LIST);
  const [open, setOpen] = useState<StoryGroup | null>(String((globalThis as { location?: { search?: string } }).location?.search ?? "").includes("open=1") ? groups[0] ?? null : null);
  const [seen, setSeen] = useState<Set<string>>(new Set([seenKeyOf(groups[1]!)]));
  return (
    <Screen>
      <T role="heading">Story tray</T>
      <View style={{ paddingVertical: 12 }}><StoryCircles groups={groups} seen={seen} onOpen={(g) => { setOpen(g); setSeen(new Set([...seen, seenKeyOf(g)])); }} /></View>
      <StoryViewer group={open} onClose={() => setOpen(null)} onNextGroup={() => { const n = open ? groups[groups.findIndex((x) => x.key === open.key) + 1] : undefined; setOpen(n ?? null); }} onPrevGroup={() => undefined} />
    </Screen>
  );
}
