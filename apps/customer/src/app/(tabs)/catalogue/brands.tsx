// Old brand-item links resolve to the same confirmed catalogue/detail route.
// A manufacturer's range list is not proof that the studio offers that product.
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { BRAND_ENQUIRIES } from "../../../lib/brand-enquiries";
import { currentServices } from "../../../lib/services-navigation";
import { Button, Loading, Notice, Screen } from "../../../ui/kit";
export default function BrandProduct() {
  const { b, n } = useLocalSearchParams<{ b?: string; n?: string }>(),
    router = useRouter();
  const [status, setStatus] = useState<"loading" | "missing" | "error">(
    "loading",
  );
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    void getServiceCatalogue()
      .then((rows) => {
        if (!alive) return;
        const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");
        const wanted = [norm(n ?? ""), norm(`${b ?? ""} ${n ?? ""}`)];
        const service = currentServices(rows).find(
          (s) =>
            norm(s.brand ?? "") === norm(b ?? "") &&
            wanted.includes(norm(s.name)),
        );
        if (service) {
          router.replace(`/(tabs)/catalogue/${service.id}`);
          return;
        }
        const ref = BRAND_ENQUIRIES.find(
          (r) =>
            norm(r.brand ?? "") === norm(b ?? "") &&
            wanted.includes(norm(r.name)),
        );
        if (ref) {
          router.replace({
            pathname: "/(tabs)/catalogue/enquiry",
            params: { id: ref.key },
          });
          return;
        }
        setStatus("missing");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [b, n, router]);
  if (status === "loading") return <Loading label="Opening current product" />;
  return (
    <Screen appBar="Services">
      <Notice
        title={
          status === "error"
            ? "Can't load the current menu"
            : "Product not currently listed"
        }
        body="Choose a confirmed offering from Services. Manufacturer information alone does not confirm availability."
        action={
          <Button
            label="Browse services"
            onPress={() => router.replace("/(tabs)/catalogue")}
          />
        }
      />
    </Screen>
  );
}
