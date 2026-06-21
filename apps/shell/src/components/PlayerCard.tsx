import { PLAYER_COLORS, PLAYER_LABELS } from "../games.js";

interface PlayerCardProps {
  slot: number;
  joined: boolean;
  /** Resolved display name — "Guest" when no profile selected. */
  profileName?: string;
  /** Profile colour dot — only set when a named profile (not guest) is selected. */
  profileColor?: string;
  /** Whether an unclaimed controller is available for this unjoined slot. */
  controllerAvailable?: boolean;
}

export function PlayerCard({ slot, joined, profileName, profileColor, controllerAvailable }: PlayerCardProps) {
  const slotColor = PLAYER_COLORS[slot] ?? "#888";
  const label = PLAYER_LABELS[slot] ?? `P${slot + 1}`;

  return (
    <div
      className={`player-card${joined ? " player-card--joined" : ""}${!joined && !controllerAvailable ? " player-card--empty" : ""}`}
      style={{ "--player-color": slotColor } as React.CSSProperties}
    >
      <div className="player-card__badge">{label}</div>

      {joined ? (
        <>
          <div className="player-card__profile">
            {profileColor && (
              <span className="player-card__profile-dot" style={{ background: profileColor }} />
            )}
            <span className="player-card__name">{profileName ?? "Guest"}</span>
          </div>
          <p className="player-card__hint">← → change profile</p>
        </>
      ) : controllerAvailable ? (
        <p className="player-card__hint">Press A to join</p>
      ) : (
        <p className="player-card__hint player-card__hint--dim">No controller</p>
      )}
    </div>
  );
}
