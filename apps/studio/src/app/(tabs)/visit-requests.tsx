import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, Text, TextInput, View } from "react-native";
import { httpsCallable } from "firebase/functions";
import { randomUUID } from "expo-crypto";
import { FIRST_STUDIO_ID, type CoordinationRequestRead } from "@autodeck/core";
import { functions } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { Button, colors, spacing, radius, typography } from "@autodeck/ui";
type Cursor = { id: string; createdAt: string };
export default function VisitRequests() {
  const auth = useAuth(),
    studioId =
      auth.status === "ready"
        ? (auth.claims.studioId ?? FIRST_STUDIO_ID)
        : null;
  const identity =
    auth.status === "ready"
      ? JSON.stringify([
          auth.user.uid,
          auth.claims.tenantId,
          auth.claims.role,
          studioId,
        ])
      : null;
  const scope = useRef({ identity, epoch: 0 });
  if (scope.current.identity !== identity)
    scope.current = { identity, epoch: scope.current.epoch + 1 };
  const key = JSON.stringify([identity, scope.current.epoch]);
  const current = useRef(key);
  current.current = key;
  const active = useRef(true),
    generation = useRef(0),
    lock = useRef(false);
  const [rows, setRows] = useState<CoordinationRequestRead[]>([]),
    [cursor, setCursor] = useState<Cursor | null>(null),
    [loaded, setLoaded] = useState<string | null>(null),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const attempts = useRef<
    Record<string, { operationId: string; reply: string }>
  >({});
  const load = useCallback(
    async (more = false, next?: Cursor) => {
      if (!identity || !studioId || !active.current) return;
      const k = key,
        e = ++generation.current;
      setBusy(true);
      setError("");
      try {
        const r = await httpsCallable<
          unknown,
          { requests: CoordinationRequestRead[]; nextCursor: Cursor | null }
        >(
          functions,
          "getVisitCoordinationRequests",
        )({ studioId, ...(more && next ? { cursor: next } : {}) });
        if (
          active.current &&
          current.current === k &&
          generation.current === e
        ) {
          setRows((old) =>
            more
              ? [
                  ...new Map(
                    [...old, ...r.data.requests].map((request) => [request.id, request]),
                  ).values(),
                ]
              : r.data.requests,
          );
          setCursor(r.data.nextCursor);
          setLoaded(k);
        }
      } catch {
        if (
          active.current &&
          current.current === k &&
          generation.current === e
        ) {
          setLoaded(null);
          setError("Requests could not load. Refresh before replying.");
        }
      } finally {
        if (active.current && current.current === k && generation.current === e)
          setBusy(false);
      }
    },
    [identity, studioId, key],
  );
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      lock.current = false;
      setBusy(false);
      setRows([]);
      setLoaded(null);
      setNotes({});
      attempts.current = {};
      void load();
      return () => {
        active.current = false;
        generation.current++;
      };
    }, [load]),
  );
  async function reply(row: CoordinationRequestRead) {
    if (
      !identity ||
      loaded !== key ||
      busy ||
      lock.current ||
      !notes[row.id]?.trim()
    )
      return;
    const k = key,
      writeEpoch = generation.current;
    lock.current = true;
    setBusy(true);
    setError("");
    const a = attempts.current[row.id] ?? {
      operationId: randomUUID(),
      reply: notes[row.id]!.trim(),
    };
    attempts.current[row.id] = a;
    try {
      const r = await httpsCallable<unknown, CoordinationRequestRead>(
        functions,
        "updateVisitCoordinationRequest",
      )({
        id: row.id,
        expectedVersion: row.version,
        operationId: a.operationId,
        action: "reply",
        reply: a.reply,
      });
      if (
        active.current &&
        current.current === k &&
        generation.current === writeEpoch
      ) {
        setRows((old) => old.map((x) => (x.id === row.id ? r.data : x)));
        delete attempts.current[row.id];
      }
    } catch {
      if (
        active.current &&
        current.current === k &&
        generation.current === writeEpoch
      )
        setError(
          "Reply was not confirmed. Retry the unchanged reply or refresh to check its status.",
        );
    } finally {
      if (current.current === k && generation.current === writeEpoch)
        lock.current = false;
      if (
        active.current &&
        current.current === k &&
        generation.current === writeEpoch
      )
        setBusy(false);
    }
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <Text style={{ ...typography.heading, color: colors.textPrimary }}>
        Visit requests
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary }}>
        Selections across bays, sent by the customer. A reply is a conversation,
        not a booking, quote, payment or work approval.
      </Text>
      <Button
        label="Refresh requests"
        disabled={busy}
        variant="ghost"
        onPress={() => void load()}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>
          {error}
        </Text>
      ) : null}
      {loaded === key ? (
        rows.length ? (
          rows.map((row) => (
            <View
              key={row.id}
              style={{
                padding: spacing.lg,
                gap: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ ...typography.title, color: colors.textPrimary }}>
                {row.customerName ?? "Customer"} ·{" "}
                {row.status === "requested"
                  ? "Awaiting reply"
                  : row.status === "answered"
                    ? "Replied"
                    : "Withdrawn"}
              </Text>
              <Text style={{ color: colors.textPrimary }}>
                {row.vehicleLabel}
              </Text>
              {row.lines.map((line) => (
                <Text
                  key={line.serviceId}
                  style={{ color: colors.textPrimary }}
                >
                  {line.name}
                </Text>
              ))}
              {row.notes ? (
                <Text style={{ color: colors.textSecondary }}>{row.notes}</Text>
              ) : null}
              {row.reply ? (
                <Text style={{ color: colors.textPrimary }}>{row.reply}</Text>
              ) : null}
              {row.status === "requested" ? (
                <>
                  <Text style={{ color: colors.textSecondary }}>
                    Visible to the customer. Discuss scope and timing; do not
                    imply a slot or price is confirmed here.
                  </Text>
                  <TextInput
                    multiline
                    accessibilityLabel={"Reply to " + row.id}
                    placeholder="Reply to the customer"
                    placeholderTextColor={colors.textMuted}
                    value={notes[row.id] ?? ""}
                    onChangeText={(text) =>
                      setNotes((old) => ({ ...old, [row.id]: text }))
                    }
                    maxLength={2000}
                    editable={!busy && !attempts.current[row.id]}
                    style={{
                      ...typography.body,
                      color: colors.textPrimary,
                      minHeight: 100,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      padding: spacing.md,
                    }}
                  />
                  <Button
                    label="Send reply"
                    disabled={busy || !notes[row.id]?.trim()}
                    onPress={() => void reply(row)}
                  />
                </>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={{ color: colors.textSecondary }}>
            No visit requests yet.
          </Text>
        )
      ) : null}
      {cursor && loaded === key ? (
        <Button
          label="Load earlier requests"
          disabled={busy}
          variant="ghost"
          onPress={() => void load(true, cursor)}
        />
      ) : null}
    </ScrollView>
  );
}
