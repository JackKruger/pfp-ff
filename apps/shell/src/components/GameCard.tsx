import { useEffect } from "react";
import { useFocusable } from "@pfp/ui";
import type { GameManifest } from "@pfp/sdk";

interface GameCardProps {
  game: GameManifest;
  onSelect: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function GameCard({ game, onSelect, autoFocus = false, disabled = false }: GameCardProps) {
  const { ref, focused } = useFocusable<HTMLDivElement>(game.id, disabled ? undefined : onSelect, { autoFocus });

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focused, ref]);

  return (
    <div
      ref={ref}
      className={`game-card${focused ? " game-card--focused" : ""}${disabled ? " game-card--disabled" : ""}`}
      onClick={disabled ? undefined : onSelect}
      role={disabled ? "presentation" : undefined}
      aria-disabled={disabled || undefined}
    >
      <div className="game-card__thumb">
        {game.thumbnail ? (
          <img src={game.thumbnail} alt="" />
        ) : (
          <span className="game-card__thumb-placeholder">{game.name[0]}</span>
        )}
      </div>
      <div className="game-card__info">
        <h3 className="game-card__name">{game.name}</h3>
        <p className="game-card__players">
          {game.players.min === game.players.max
            ? `${game.players.min} players`
            : `${game.players.min}–${game.players.max} players`}
        </p>
        {disabled ? (
          <p className="game-card__coming-soon">Coming Soon</p>
        ) : (
          game.tags && game.tags.length > 0 && (
            <p className="game-card__tags">{game.tags.join(" · ")}</p>
          )
        )}
      </div>
    </div>
  );
}
