import { PLAYER_COLORS, PLAYER_LABELS } from "../games.js";

interface PlayerCardProps {
  slot: number;
  joined: boolean;
  displayName?: string;
}

export function PlayerCard({ slot, joined, displayName }: PlayerCardProps) {
  const color = PLAYER_COLORS[slot] ?? "#888";
  const label = PLAYER_LABELS[slot] ?? `P${slot + 1}`;

  return (
    <div className={`player-card${joined ? " player-card--joined" : ""}`} style={{ "--player-color": color } as React.CSSProperties}>
      <div className="player-card__badge">{label}</div>
      {joined ? (
        <div className="player-card__name">{displayName ?? "Guest"}</div>
      ) : (
        <div className="player-card__hint">Press A to join</div>
      )}
    </div>
  );
}
