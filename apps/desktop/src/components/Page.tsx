import type { ReactNode } from "react";
import { sectionById, type SectionId } from "../lib/catalog";
import type { Behavior } from "../lib/types";
import { useApp } from "../state";
import { Banner, Button, PageHeader } from "./ui";

/**
 * Standard page frame. Renders its children only when the native engine has
 * answered, so no control ever edits settings that do not exist.
 */
export function Page({
  id, actions, children,
}: {
  id: SectionId;
  actions?: ReactNode;
  children: (b: Behavior, edit: (fn: (b: Behavior) => void) => void) => ReactNode;
}) {
  const { behavior, patchBehavior, snapshot, native, error, patch } = useApp();
  const s = sectionById(id)!;
  return (
    <>
      <PageHeader title={s.name} subtitle={s.tagline} icon={s.icon} actions={actions} />
      {!snapshot || !behavior ? (
        <Banner tone="bad">
          {native
            ? (error ?? "Waiting for the native engine…")
            : "The native engine is not running. Open the MouseMore desktop app to use this page."}
        </Banner>
      ) : (
        <>
          {!snapshot.settings.global_enabled && (
            <Banner>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <b>MouseMore is switched off.</b> You can change settings here and they are saved, but nothing is active until you turn it back on.
                </span>
                <Button size="sm" variant="primary" onClick={() => void patch({ global_enabled: true })}>Turn MouseMore on</Button>
              </div>
            </Banner>
          )}
          {children(behavior, patchBehavior)}
        </>
      )}
    </>
  );
}
