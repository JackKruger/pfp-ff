import { useEffect } from "react";
import { useFocusable } from "@pfp/ui";
import type { GameEntry } from "../games.js";

interface GameCardProps {
  game: GameEntry;
  onSelect: () => void;
  /** Stagger index — drives the load-in animation delay. */
  index?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

/** Four controller "ports": filled = required players, ringed = supported, dim = unused. */
function PlayerPips({ min, max }: { min: number; max: number }) {
  const label = min === max ? `${min} players` : `${min} to ${max} players`;
  return (
    <span className="pips" role="img" aria-label={label}>
      {[0, 1, 2, 3].map((i) => {
        const state = i < min ? "on" : i < max ? "open" : "off";
        return <span key={i} className={`pips__dot pips__dot--${state}`} />;
      })}
    </span>
  );
}

export function GameCard({
  game,
  onSelect,
  index = 0,
  autoFocus = false,
  disabled = false,
}: GameCardProps) {
  const { ref, focused } = useFocusable<HTMLDivElement>(game.id, disabled ? undefined : onSelect, {
    autoFocus,
  });

  useEffect(() => {
    if (focused)
      ref.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focused, ref]);

  const playerLabel =
    game.players.min === game.players.max
      ? `${game.players.min} players`
      : `${game.players.min}–${game.players.max} players`;

  return (
    <div
      ref={ref}
      className={`game-card${focused ? " game-card--focused" : ""}${disabled ? " game-card--locked" : ""}`}
      style={{ ["--accent" as string]: game.accent, animationDelay: `${index * 60}ms` }}
      onClick={disabled ? undefined : onSelect}
      role={disabled ? "group" : "button"}
      tabIndex={-1}
      aria-label={disabled ? `${game.name} — coming soon` : `Play ${game.name}, ${playerLabel}`}
      aria-disabled={disabled || undefined}
    >
      <div className="game-card__thumb">
        {game.thumbnail ? (
          <img className="game-card__art" src={game.thumbnail} alt={`${game.name} cover art`} />
        ) : (
          <span className="game-card__placeholder" aria-hidden="true">
            <span className="game-card__placeholder-icon">{game.icon}</span>
          </span>
        )}

        {disabled ? (
          <>
            <span className="game-card__lock" aria-hidden="true">
              🔒
            </span>
            <span className="game-card__ribbon">Coming Soon</span>
          </>
        ) : (
          <span className="game-card__play-overlay" aria-hidden="true">
            <span className="game-card__play-fab">▶</span>
          </span>
        )}
      </div>

      <div className="game-card__info">
        <h3 className="game-card__name">{game.name}</h3>
        <div className="game-card__meta">
          <PlayerPips min={game.players.min} max={game.players.max} />
          {game.tags && game.tags.length > 0 && (
            <span className="game-card__tags">{game.tags.slice(0, 2).join(" · ")}</span>
          )}
        </div>
      </div>

      {disabled ? (
        <span className="game-card__cta game-card__cta--locked">
          <span aria-hidden="true">🔒</span> Coming Soon
        </span>
      ) : (
        <span className="game-card__cta game-card__cta--play">
          <span aria-hidden="true">▶</span> Play
        </span>
      )}
    </div>
  );
}
