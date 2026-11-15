"use client";

// Dev preview of the staff shell with sample content. No auth, no data. Used to check the
// navigation at phone, tablet and desktop widths: /design/shell-nav?p=/jobs
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StaffShell } from "../../../experience/StaffShell";
import { PageHead } from "../../../experience/Office";
import { ThemeStyle } from "../../../experience";

function Preview() {
  const p = useSearchParams().get("p") ?? "/jobs";
  return (
    <>
      <ThemeStyle />
      <StaffShell pathname={p} office role="admin" who="Preview" home="/dashboard" onSignOut={() => undefined}>
        <div className="ax-page">
          <PageHead eyebrow="Preview" title={p.replace("/", "") || "Today"} kpis={[{ value: 6, label: "Today" }, { value: 4, label: "In progress" }]} />
          <div className="ax-panel"><p>Sample content for {p}</p></div>
        </div>
      </StaffShell>
    </>
  );
}

export default function ShellPreview() {
  return <Suspense><Preview /></Suspense>;
}
