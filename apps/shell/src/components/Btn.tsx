import { useFocusable } from "@pfp/ui";

interface BtnProps {
  id: string;
  onClick: () => void;
  children: React.ReactNode;
  autoFocus?: boolean;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}

export function Btn({ id, onClick, children, autoFocus = false, variant = "primary", disabled = false }: BtnProps) {
  const { ref, focused } = useFocusable<HTMLButtonElement>(id, disabled ? undefined : onClick, { autoFocus });

  return (
    <button
      ref={ref}
      className={`btn btn--${variant}${focused ? " btn--focused" : ""}${disabled ? " btn--disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
}
