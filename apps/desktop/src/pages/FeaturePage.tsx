import { Info } from "lucide-react";
import type { Section } from "../lib/catalog";
import { Card, PageHeader, StatusBadge } from "../components/ui";

/**
 * Generic page for sections whose features are not built yet. It deliberately
 * renders no toggles or buttons: a control that does nothing would be a lie.
 */
export function FeaturePage({ section }: { section: Section }) {
  const working = section.features.filter((f) => f.status === "working");
  const rest = section.features.filter((f) => f.status !== "working");
  return (
    <>
      <PageHeader title={section.name} subtitle={section.tagline} icon={section.icon} />
      {working.length === 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-line bg-raised px-4 py-3 text-mute">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            Nothing in this section is available yet, so there are no controls to show. Each item below is labelled
            with its roadmap phase. See <span className="font-mono text-fg">docs/ROADMAP.md</span>.
          </p>
        </div>
      )}
      <ul className="grid gap-3">
        {[...working, ...rest].map((f) => (
          <li key={f.id}>
            <Card className="!p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{f.name}</h2>
                  <p className="mt-1 text-mute">{f.description}</p>
                  {f.note && <p className="mt-2 text-xs text-mute">{f.note}</p>}
                </div>
                <StatusBadge status={f.status} phase={f.phase} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
