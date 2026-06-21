import { useFocusable } from "@pfp/ui";

interface BtnProps {
  id: string;
  onClick: () => void;
  children: React.ReactNode;
  autoFocus?: boolean;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  /** Focus scope — set to confine this button to a modal/overlay layer. */
  scope?: string;
}

export function Btn({
  id,
  onClick,
  children,
  autoFocus = false,
  variant = "primary",
  disabled = false,
  scope,
}: BtnProps) {
  const { ref, focused } = useFocusable<HTMLButtonElement>(id, disabled ? undefined : onClick, {
    autoFocus,
    scope,
  });

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
