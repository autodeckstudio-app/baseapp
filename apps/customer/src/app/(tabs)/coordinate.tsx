import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { TextInput, View } from "react-native";
import {
  FIRST_STUDIO_ID,
  selectionScopeIssue,
  type Service,
  type CoordinationRequestRead,
} from "@autodeck/core";
import { useAuth } from "../../hooks/useAuth";
import { usePricingVehicle } from "../../lib/vehicle-size";
import { getServiceCatalogue } from "../../lib/catalogue-service";
import {
  coordinationOperationId,
  getVisitCoordinationRequests,
  requestVisitCoordination,
  withdrawVisitCoordinationRequest,
  type CoordinationCursor,
} from "../../lib/visit-coordination";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Screen, T, Button, Notice, Pane } from "../../ui/kit";
export default function CoordinateVisit() {
  const { colors } = useExperienceTheme();
  const auth = useAuth(),
    car = usePricingVehicle(),
    router = useRouter(),
    params = useLocalSearchParams<{ services?: string }>();
  const parsed =
    typeof params.services === "string" ? params.services.split(",") : [];
  const ids =
    parsed.length <= 5 &&
    new Set(parsed).size === parsed.length &&
    parsed.every((id) => /^[A-Za-z0-9_-]{1,120}$/.test(id))
      ? parsed
      : null;
  const validIds = ids && ids.length >= 2 && ids.length <= 5 ? ids : null;
  const identity =
    auth.status === "ready"
      ? JSON.stringify([
          auth.user.uid,
          auth.claims.tenantId,
          auth.customerDocId,
        ])
      : null;
  const rawKey = JSON.stringify([identity, params.services, car.vehicle?.id]);
  const scope = useRef({ rawKey, epoch: 0 });
  if (scope.current.rawKey !== rawKey)
    scope.current = { rawKey, epoch: scope.current.epoch + 1 };
  const key = JSON.stringify([rawKey, scope.current.epoch]);
  const current = useRef(key);
  current.current = key;
  const active = useRef(true),
    lock = useRef(false),
    epoch = useRef(0);
  const [loaded, setLoaded] = useState<string | null>(null),
    [catalogue, setCatalogue] = useState<Service[]>([]),
    [rows, setRows] = useState<CoordinationRequestRead[]>([]),
    [cursor, setCursor] = useState<CoordinationCursor | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notes, setNotes] = useState(""),
    [sent, setSent] = useState<string | null>(null),
    [attempted, setAttempted] = useState<string | null>(null);
  const operation = useRef({ key: "", id: "" });
  if (operation.current.key !== key)
    operation.current = { key, id: coordinationOperationId() };
  const load = useCallback(
    async (more = false, next?: CoordinationCursor) => {
      if (!identity || !active.current) return;
      const k = key,
        e = ++epoch.current;
      setBusy(true);
      setError("");
      try {
        const [result, services] = await Promise.all([
          getVisitCoordinationRequests(more ? next : undefined),
          getServiceCatalogue(undefined, { fresh: true }),
        ]);
        if (!active.current || current.current !== k || epoch.current !== e)
          return;
        setRows((old) =>
          more
            ? [
                ...new Map(
                  [...old, ...result.requests].map((r) => [r.id, r]),
                ).values(),
              ]
            : result.requests,
        );
        setCursor(result.nextCursor);
        setCatalogue(services);
        setLoaded(k);
        if (
          result.requests.some(
            (r) =>
              r.status !== "withdrawn" &&
              r.vehicleId === car.vehicle?.id &&
              JSON.stringify(r.lines.map((l) => l.serviceId).sort()) ===
                JSON.stringify([...(validIds ?? [])].sort()),
          )
        )
          setSent(k);
      } catch {
        if (active.current && current.current === k && epoch.current === e) {
          setLoaded(null);
          setError("Requests could not load. Refresh before continuing.");
        }
      } finally {
        if (active.current && current.current === k && epoch.current === e)
          setBusy(false);
      }
    },
    [identity, key],
  );
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      lock.current = false;
      setBusy(false);
      setLoaded(null);
      setRows([]);
      setNotes("");
      setSent(null);
      setAttempted(null);
      void load();
      return () => {
        active.current = false;
        epoch.current++;
      };
    }, [load]),
  );
  const chosen = (validIds ?? [])
    .map((id) => catalogue.find((s) => s.id === id))
    .filter((s): s is Service => !!s);
  const issue = selectionScopeIssue(chosen);
  const valid =
    !!validIds &&
    chosen.length === validIds.length &&
    !issue &&
    new Set(chosen.map((s) => s.requiredBayType)).size > 1 &&
    chosen.every(
      (s) =>
        s.active &&
        !s.customerMenu?.bookingMode &&
        !s.priceOnRequest &&
        s.basePrice > 0 &&
        s.estimatedDurationMinutes > 0,
    );
  const ready = loaded === key && !busy && !lock.current;
  async function submit() {
    if (!ready || !valid || !validIds || !car.vehicle) return;
    const k = key,
      writeEpoch = epoch.current;
    lock.current = true;
    setBusy(true);
    setAttempted(k);
    setError("");
    try {
      const row = await requestVisitCoordination({
        operationId: operation.current.id,
        studioId: FIRST_STUDIO_ID,
        vehicleId: car.vehicle.id,
        serviceIds: validIds,
        notes: notes.trim(),
      });
      if (
        active.current &&
        current.current === k &&
        epoch.current === writeEpoch
      ) {
        setRows((old) => [row, ...old.filter((r) => r.id !== row.id)]);
        setSent(k);
      }
    } catch {
      if (
        active.current &&
        current.current === k &&
        epoch.current === writeEpoch
      )
        setError(
          "Sending was not confirmed. Keep this selection and retry to check the same request.",
        );
    } finally {
      if (current.current === k && epoch.current === writeEpoch)
        lock.current = false;
      if (
        active.current &&
        current.current === k &&
        epoch.current === writeEpoch
      )
        setBusy(false);
    }
  }
  async function withdraw(row: CoordinationRequestRead) {
    if (!ready) return;
    const k = key,
      writeEpoch = epoch.current;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await withdrawVisitCoordinationRequest(
        row,
        coordinationOperationId(),
      );
      if (
        active.current &&
        current.current === k &&
        epoch.current === writeEpoch
      )
        setRows((old) => old.map((r) => (r.id === next.id ? next : r)));
    } catch {
      if (
        active.current &&
        current.current === k &&
        epoch.current === writeEpoch
      ) {
        setLoaded(null);
        setError("Withdrawal was not confirmed. Refresh before trying again.");
      }
    } finally {
      if (current.current === k && epoch.current === writeEpoch)
        lock.current = false;
      if (
        active.current &&
        current.current === k &&
        epoch.current === writeEpoch
      )
        setBusy(false);
    }
  }
  return (
    <Screen appBar="Coordinate a visit">
      <T role="title">{validIds ? "Plan one visit" : "Visit requests"}</T>
      <T>
        Send these services to the studio for review. Timing and work need
        separate agreement. No slot or payment is made here.
      </T>
      <Button
        label="Refresh requests"
        kind="quiet"
        disabled={busy}
        onPress={() => void load()}
      />
      {error ? <Notice title="Request needs a check" body={error} /> : null}
      {validIds && sent !== key ? (
        <Pane>
          <T role="heading">Your selection</T>
          {loaded === key ? (
            chosen.map((s) => <T key={s.id}>{s.name}</T>)
          ) : (
            <T>Checking current services...</T>
          )}
          <T>
            {car.vehicle
              ? [
                  car.vehicle.make,
                  car.vehicle.model,
                  car.vehicle.registrationNumber,
                ]
                  .filter(Boolean)
                  .join(" ")
              : "Choose a saved car before sending."}
          </T>
          <Button
            label="Choose a car"
            kind="quiet"
            disabled={busy || attempted === key}
            onPress={() => router.push("/(tabs)/garage")}
          />
          {loaded === key && !valid ? (
            <T>
              {issue ??
                "This selection changed or can use normal booking. Return to Services to review it."}
            </T>
          ) : null}
          <TextInput
            accessibilityLabel="What should the studio know?"
            placeholder="Anything to help the team plan? (optional)"
            value={notes}
            onChangeText={(text) => {
              setNotes(text);
              operation.current = { key, id: coordinationOperationId() };
            }}
            multiline
            style={{
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              borderRadius: 12,
              padding: 12,
              minHeight: 96,
            }}
            placeholderTextColor={colors.textSecondary}
            maxLength={1000}
            editable={!busy && attempted !== key}
          />
          <Button
            label="Send visit request"
            disabled={!ready || !valid || !car.vehicle}
            onPress={() => void submit()}
          />
        </Pane>
      ) : sent === key ? (
        <Notice
          title={
            rows.some(
              (r) =>
                r.vehicleId === car.vehicle?.id && r.status !== "withdrawn",
            )
              ? "Request received"
              : "Request withdrawn"
          }
          body={
            rows.some(
              (r) =>
                r.vehicleId === car.vehicle?.id && r.status !== "withdrawn",
            )
              ? "The studio's response will appear below. Timing and any work still need agreement."
              : "This request is no longer awaiting studio action. No booking or work was created."
          }
        />
      ) : null}
      <T role="heading">Your requests</T>
      {loaded === key ? (
        rows.length ? (
          rows.map((row) => (
            <Pane key={row.id}>
              <T role="heading">
                {row.status === "requested"
                  ? "Awaiting studio reply"
                  : row.status === "answered"
                    ? "Studio replied"
                    : "Withdrawn"}
              </T>
              <T>{row.vehicleLabel}</T>
              {row.lines.map((line) => (
                <T key={line.serviceId}>{line.name}</T>
              ))}
              {row.notes ? <T>{row.notes}</T> : null}
              {row.reply ? <T>{row.reply}</T> : null}
              {row.status !== "withdrawn" ? (
                <Button
                  label="Withdraw request"
                  kind="quiet"
                  disabled={!ready}
                  onPress={() => void withdraw(row)}
                />
              ) : null}
            </Pane>
          ))
        ) : (
          <T>No requests yet.</T>
        )
      ) : null}
      {cursor && loaded === key ? (
        <Button
          label="Load earlier requests"
          kind="quiet"
          disabled={busy}
          onPress={() => void load(true, cursor)}
        />
      ) : null}
      <Button
        label="Back to Services"
        kind="quiet"
        onPress={() => router.navigate("/(tabs)/catalogue")}
      />
    </Screen>
  );
}
