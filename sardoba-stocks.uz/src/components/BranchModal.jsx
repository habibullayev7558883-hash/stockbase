import { useState } from "react";
import Icon from "./Icon.jsx";
import { Modal, useToast } from "./ui.jsx";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

/**
 * Filial tanlash va boshqarish oynasi.
 * Admin: filialni almashtiradi, nomini o'zgartiradi, yangi filial qo'shadi yoki o'chiradi.
 * Xodim: faqat o'z filialini ko'radi.
 */
export default function BranchModal({ open, onClose }) {
  const toast = useToast();
  const { isAdmin, branches, branch, allBranches, switchBranch, reloadBranches } = useAuth();
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const rename = (b) =>
    run(async () => {
      await api(`/branches/${b._id}`, { method: "PUT", body: { name: editName } });
      await reloadBranches();
      setEditId(null);
      toast("Filial nomi o'zgartirildi");
    });

  const add = () =>
    run(async () => {
      await api("/branches", { method: "POST", body: { name: newName } });
      await reloadBranches();
      setNewName("");
      toast("Yangi filial qo'shildi");
    });

  const remove = (b) => {
    if (!confirm(`«${b.name}» filiali o'chirilsinmi? Uning savdo tarixi saqlanib qoladi, lekin ro'yxatda ko'rinmaydi.`)) return;
    run(async () => {
      await api(`/branches/${b._id}`, { method: "DELETE" });
      if (branch?._id === b._id) return switchBranch(branches.find((x) => x._id !== b._id)?._id || "");
      await reloadBranches();
      toast("Filial o'chirildi");
    });
  };

  const close = () => {
    setEditId(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} kicker="FILIALLAR" title={isAdmin ? "Filialni tanlang" : "Sizning filialingiz"} width={480}>
      {isAdmin && (
        <p className="muted small mb14">
          Ombor hamma filiallar uchun bitta. Sotuv, xarajat, ta'minotchilar va hisobotlar har bir filialda alohida yuritiladi.
        </p>
      )}
      <div className="branch-list">
        {branches.map((b) => {
          const active = branch?._id === b._id;
          if (editId === b._id) {
            return (
              <form key={b._id} className="branch-row editing" onSubmit={(e) => { e.preventDefault(); rename(b); }}>
                <span className="input-wrap grow">
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Filial nomi" />
                </span>
                <button className="btn btn-primary btn-sm" disabled={busy || !editName.trim()}>
                  <Icon name="check" size={14} /> Saqlash
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>
                  Bekor
                </button>
              </form>
            );
          }
          return (
            <div key={b._id} className={"branch-row" + (active ? " active" : "")}>
              <button className="branch-pick" disabled={!isAdmin || active} onClick={() => switchBranch(b._id)}>
                <span className="iconbox ib-green" style={{ width: 34, height: 34 }}>
                  <Icon name="store" size={17} />
                </span>
                <b>{b.name}</b>
                {active && <span className="pill pill-green">Tanlangan</span>}
              </button>
              {isAdmin && (
                <>
                  <button className="icon-btn" title="Nomini o'zgartirish" onClick={() => { setEditId(b._id); setEditName(b.name); }}>
                    <Icon name="edit" size={16} />
                  </button>
                  {branches.length > 1 && (
                    <button className="icon-btn danger" title="Filialni o'chirish" disabled={busy} onClick={() => remove(b)}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}

        {isAdmin && branches.length > 1 && (
          <div className={"branch-row" + (allBranches ? " active" : "")}>
            <button className="branch-pick" disabled={allBranches} onClick={() => switchBranch("all")}>
              <span className="iconbox ib-purple" style={{ width: 34, height: 34 }}>
                <Icon name="grid" size={17} />
              </span>
              <div className="grow">
                <b>Barcha filiallar</b>
                <small className="muted block">Umumiy hisobot (faqat ko'rish)</small>
              </div>
              {allBranches && <span className="pill pill-green">Tanlangan</span>}
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <form className="branch-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <h4 className="form-sec">Yangi filial qo'shish</h4>
          <div className="row gap10">
            <span className="input-wrap grow">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Masalan: Sardoba 3" />
            </span>
            <button className="btn btn-primary" disabled={busy || !newName.trim()}>
              <Icon name="plus" size={16} /> Qo'shish
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
