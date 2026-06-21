import { useEffect, useRef, useState } from "react";
import { useFocusable, useFocusManager } from "@pfp/ui";
import { Btn } from "../components/Btn.js";
import { useShell } from "../store.js";
import type { Profile } from "@pfp/data";
import { PLAYER_COLORS } from "../games.js";

const PRESET_COLORS = [...PLAYER_COLORS, "#a855f7", "#ec4899", "#14b8a6", "#f97316"];

/** Modal layer: navigation/selection is trapped here so a controller can't drift to the rows behind. */
const MODAL_SCOPE = "profile-modal";

function ColorSwatch({
  color,
  active,
  onPick,
}: {
  color: string;
  active: boolean;
  onPick: () => void;
}) {
  const { ref, focused } = useFocusable<HTMLButtonElement>(`color-${color}`, onPick, {
    scope: MODAL_SCOPE,
  });
  return (
    <button
      ref={ref}
      className={`modal__color${active ? " modal__color--active" : ""}${focused ? " modal__color--focused" : ""}`}
      style={{ background: color }}
      onClick={onPick}
      aria-label={`Color ${color}`}
      aria-pressed={active}
    />
  );
}

function ProfileRow({
  profile,
  index,
  onEdit,
  onDelete,
}: {
  profile: Profile;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { ref, focused } = useFocusable<HTMLDivElement>(`profile-${profile.id}`, onEdit, {
    autoFocus: index === 0,
  });

  return (
    <div
      ref={ref}
      className={`profile-row${focused ? " profile-row--focused" : ""}`}
      onClick={onEdit}
    >
      <div className="profile-row__dot" style={{ background: profile.color }} />
      <span className="profile-row__name">{profile.name}</span>
      <button
        className="profile-row__delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${profile.name}`}
      >
        ✕
      </button>
    </div>
  );
}

interface EditModalProps {
  profile: Profile | null;
  /** Suggested name for a new profile, so controller users (who can't type) can still save. */
  defaultName: string;
  onSave: (name: string, color: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function EditModal({ profile, defaultName, onSave, onDelete, onClose }: EditModalProps) {
  const manager = useFocusManager();
  const [name, setName] = useState(profile?.name ?? defaultName);
  const [color, setColor] = useState(profile?.color ?? PRESET_COLORS[0]);

  const save = () => name.trim() && onSave(name.trim(), color);

  // Trap focus in the modal while it's open; route B / Esc to closing it.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    manager.pushScope(MODAL_SCOPE, () => onCloseRef.current());
    return () => manager.popScope();
  }, [manager]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{profile ? "Edit Profile" : "New Profile"}</h3>
        <label className="modal__label">
          Name
          <input
            className="modal__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              else if (e.key === "Escape") onClose();
            }}
            autoFocus
            maxLength={20}
          />
        </label>
        <div className="modal__colors">
          {PRESET_COLORS.map((c) => (
            <ColorSwatch key={c} color={c} active={c === color} onPick={() => setColor(c)} />
          ))}
        </div>
        <div className={`modal__actions${onDelete ? " modal__actions--has-delete" : ""}`}>
          {onDelete && (
            <Btn id="modal-delete" variant="ghost" scope={MODAL_SCOPE} onClick={onDelete}>
              Delete
            </Btn>
          )}
          <Btn id="modal-cancel" variant="ghost" scope={MODAL_SCOPE} onClick={onClose}>
            Cancel
          </Btn>
          <Btn id="modal-save" scope={MODAL_SCOPE} onClick={save} disabled={!name.trim()}>
            Save
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function ProfilesScreen() {
  const { navigate, profiles, createProfile, updateProfile, deleteProfile } = useShell();
  const [editing, setEditing] = useState<Profile | null | "new">(null);

  async function handleSave(name: string, color: string) {
    if (editing === "new") {
      await createProfile({ name, color });
    } else if (editing) {
      await updateProfile(editing.id, { name, color });
    }
    setEditing(null);
  }

  const newRef = useFocusable<HTMLDivElement>("profile-new", () => setEditing("new"), {
    autoFocus: profiles.length === 0,
  });

  return (
    <div className="screen profiles-screen">
      <header className="profiles-screen__header">
        <h2>Profiles</h2>
      </header>

      <div className="profiles-screen__list">
        {profiles.map((p, i) => (
          <ProfileRow
            key={p.id}
            profile={p}
            index={i}
            onEdit={() => setEditing(p)}
            onDelete={() => deleteProfile(p.id)}
          />
        ))}
        <div
          ref={newRef.ref}
          className={`profile-new${newRef.focused ? " profile-new--focused" : ""}`}
          onClick={() => setEditing("new")}
        >
          + New Profile
        </div>
      </div>

      <div className="profiles-screen__actions">
        <Btn id="profiles-back" onClick={() => navigate("home")} variant="ghost">
          ← Back
        </Btn>
      </div>

      {editing !== null && (
        <EditModal
          profile={editing === "new" ? null : editing}
          defaultName={`Player ${profiles.length + 1}`}
          onSave={handleSave}
          onDelete={
            editing !== "new"
              ? () => {
                  deleteProfile(editing.id);
                  setEditing(null);
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
