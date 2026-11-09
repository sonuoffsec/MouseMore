import { Cable, Cpu, RefreshCw } from "lucide-react";
import { Banner, Button, Card, Empty, PageHeader, SectionTitle, StatusBadge } from "../components/ui";
import { deviceTitle, pluralize } from "../lib/format";
import { useActivity } from "../lib/useActivity";
import { useApp } from "../state";

const yesNo = (b: boolean) => (b ? "Yes" : "No");

function Fact({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <dt className="text-xs text-mute">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}

export function Devices() {
  const { devices, capabilities, refreshHardware, native, snapshot } = useApp();
  const activity = useActivity();
  return (
    <>
      <PageHeader
        title="Devices"
        subtitle="Only what Windows actually reports"
        icon={Cpu}
        actions={<Button icon={RefreshCw} onClick={() => void refreshHardware()} disabled={!native}>Rescan</Button>}
      />
      {!native && <Banner tone="bad">The native engine is not running, so no real device information is available.</Banner>}

      {devices && (
        <>
          <SectionTitle>System summary</SectionTitle>
          <Card>
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-5">
              <Fact k="Mouse present" v={yesNo(devices.system.present)} />
              <Fact k="Buttons" v={devices.system.buttons} />
              <Fact k="Wheel" v={yesNo(devices.system.wheel)} />
              <Fact k="Tilt wheel" v={yesNo(devices.system.horizontal_wheel)} />
              <Fact k="Buttons swapped" v={yesNo(devices.system.buttons_swapped)} />
            </dl>
            <p className="mt-4 border-t border-line pt-3 text-[13px] text-mute">
              Estimated report rate:{" "}
              {snapshot?.settings.live_monitor
                ? <b className="text-fg">{activity?.rate_hz ? `≈ ${activity.rate_hz} Hz (peak)` : "move the mouse quickly…"}</b>
                : "turn on the live input monitor on the Overview page, then move the mouse."}
            </p>
          </Card>

          <SectionTitle hint={pluralize(devices.devices.length, "device")}>Pointing devices</SectionTitle>
          {devices.note && <p className="mb-3 text-mute">{devices.note}</p>}
          <ul className="grid gap-3">
            {devices.devices.length === 0 && !devices.note && <Empty>No pointing devices found.</Empty>}
            {devices.devices.map((d, i) => (
              <li key={d.path}>
                <Card>
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-accent"><Cable size={17} aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{deviceTitle(d, i)}</h3>
                      {d.vendor_id && d.product_id && <p className="font-mono text-xs text-mute">VID {d.vendor_id} · PID {d.product_id}</p>}
                      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Fact k="Connection" v={d.connection ?? "Unknown"} />
                        <Fact k="Buttons" v={d.buttons || "Not reported"} />
                        <Fact k="Tilt wheel" v={yesNo(d.has_horizontal_wheel)} />
                        <Fact k="Driver-stated rate" v={d.reported_sample_rate_hz ? `${d.reported_sample_rate_hz} Hz` : "Not reported"} />
                      </dl>
                      <p className="mt-3 break-all font-mono text-[11px] text-mute">{d.path}</p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle hint="probed on this machine">Compatibility checker</SectionTitle>
      <ul className="grid gap-3">
        {capabilities?.map((c) => (
          <li key={c.id}>
            <Card className="!p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-1 text-[13px] text-mute">{c.detail}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
