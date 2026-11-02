"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, PencilLine, Save, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

let toastId = 0;

export function ReportActions({
  reportId,
  initialSummary,
  editedByUser,
}: {
  reportId: string;
  initialSummary: string;
  editedByUser: boolean;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function save() {
    setBusy("save");
    try {
      const response = await fetch(`/api/reset/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not save the summary.", "error");
        return;
      }
      setEditing(false);
      toast("Summary saved. It is now marked as edited by you.");
      router.refresh();
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      const response = await fetch(`/api/reset/reports/${reportId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not delete the report.", "error");
        return;
      }
      router.push("/reset/reports");
    } catch {
      toast("Network error — try again.", "error");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <section className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Agent summary</h2>
            <p className="mt-0.5 text-[0.65rem] text-white/35">
              {editedByUser ? "Edited by you — the agent will keep your version." : "Quotes your notebook. Delete or rewrite anything that is not right."}
            </p>
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost text-[0.7rem]">
              <PencilLine className="h-3.5 w-3.5" /> Edit summary
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-3">
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={5}
              className="field resize-none text-[0.78rem] leading-relaxed"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void save()} disabled={busy !== null} className="btn btn-primary text-[0.74rem]">
                {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save summary
              </button>
              <button
                type="button"
                onClick={() => {
                  setSummary(initialSummary);
                  setEditing(false);
                }}
                className="btn btn-quiet text-[0.7rem]"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2.5 text-[0.78rem] leading-[1.7] text-white/55">{summary}</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <a href={`/api/reset/reports/${reportId}`} download className="btn btn-ghost text-[0.72rem]">
          <Download className="h-3.5 w-3.5" /> Export report
        </a>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="btn btn-ghost text-[0.72rem] text-rose-200/70 hover:text-rose-200"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete report
        </button>
        <p className="ml-auto text-[0.6rem] text-white/25">Deleting removes the report and its notebook answers.</p>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this report?"
        subtitle="The report and its notebook answers will be removed. The check-ins stay in the plan."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteOpen(false)} className="btn btn-ghost text-[0.76rem]">
              Keep it
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy !== null}
              className="btn border border-rose-400/30 bg-rose-500/15 text-[0.76rem] text-rose-100 hover:bg-rose-500/25"
            >
              {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete report
            </button>
          </div>
        }
      >
        <p className="text-[0.78rem] leading-relaxed text-white/55">
          You can rebuild a numbers-only draft from the reports page, but your written answers will be gone.
        </p>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
