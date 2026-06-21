import { useState } from "react";
import { useFocusable } from "@pfp/ui";
import { Btn } from "../components/Btn.js";
import { useShell } from "../store.js";
import type { Profile } from "@pfp/data";
import { PLAYER_COLORS } from "../games.js";

const PRESET_COLORS = [...PLAYER_COLORS, "#a855f7", "#ec4899", "#14b8a6", "#f97316"];

function ProfileRow({ profile, index, onEdit, onDelete }: { profile: Profile; index: number; onEdit: () => void; onDelete: () => void }) {
  const { ref, focused } = useFocusable<HTMLDivElement>(`profile-${profile.id}`, onEdit, { autoFocus: index === 0 });

  return (
    <div ref={ref} className={`profile-row${focused ? " profile-row--focused" : ""}`} onClick={onEdit}>
      <div className="profile-row__dot" style={{ background: profile.color }} />
      <span className="profile-row__name">{profile.name}</span>
      <button
        className="profile-row__delete"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={`Delete ${profile.name}`}
      >
        ✕
      </button>
    </div>
  );
}

interface EditModalProps {
  profile: Profile | null;
  onSave: (name: string, color: string) => void;
  onClose: () => void;
}

function EditModal({ profile, onSave, onClose }: EditModalProps) {
  const [name, setName] = useState(profile?.name ?? "");
  const [color, setColor] = useState(profile?.color ?? PRESET_COLORS[0]);

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
            autoFocus
            maxLength={20}
          />
        </label>
        <div className="modal__colors">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`modal__color${c === color ? " modal__color--active" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn--primary"
            onClick={() => name.trim() && onSave(name.trim(), color)}
            disabled={!name.trim()}
          >
            Save
          </button>
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

  const newRef = useFocusable<HTMLDivElement>(
    "profile-new",
    () => setEditing("new"),
    { autoFocus: profiles.length === 0 },
  );

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
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
