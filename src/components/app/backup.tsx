"use client";

import { useRef, useState } from "react";

import { useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { backupOf, deviceBackup, restoreBackup } from "@/modules/progress/local";
import { useDevice, writeDevice } from "@/modules/progress/store";

/** Largest backup file read (a device with many readers is still far below this). */
const MAX_BYTES = 5_000_000;

/**
 * Saves every reader on this device to a file, and brings such a file back on this or another device
 * without losing what is already here. For families and classes without accounts.
 */
export function DeviceBackupCard() {
  const t = useT();
  const device = useDevice();
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const download = () => {
    const blob = new Blob([JSON.stringify(backupOf(device), null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nur-albayan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNote({ ok: true, text: t("backup.saved", { n: t.num(device.profiles.length) }) });
  };

  const restore = async (f: File | undefined) => {
    setNote(null);
    if (!f) return;
    try {
      if (f.size > MAX_BYTES) throw new Error("too big");
      const parsed = deviceBackup.safeParse(JSON.parse(await f.text()));
      if (!parsed.success) throw new Error("not a backup");
      const r = restoreBackup(device, parsed.data);
      writeDevice(r.state);
      setNote({ ok: true, text: t("backup.restored", { added: t.num(r.added), merged: t.num(r.merged) }) });
    } catch {
      setNote({ ok: false, text: t("backup.bad") });
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  return (
    <section className="nb-card nb-anim-rise">
      <h2 className="nb-h2">{t("backup.title")}</h2>
      <p className="nb-muted nb-m0">{t("backup.text")}</p>
      <div className="nb-row nb-backup-actions">
        <button
          type="button"
          className="nb-btn nb-btn-soft nb-w-auto"
          disabled={!device.profiles.length}
          onClick={download}
        >
          <Icon name="box" size={22} tone="sky" /> {t("backup.save")}
        </button>
        <button type="button" className="nb-btn nb-btn-quiet" onClick={() => file.current?.click()}>
          {t("backup.restore")}
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="nb-sr"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void restore(e.target.files?.[0])}
        />
      </div>
      {note && (
        <p className={`nb-m0 ${note.ok ? "nb-muted" : "nb-error"}`} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      )}
    </section>
  );
}
