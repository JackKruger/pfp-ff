export type FocusDirection = "up" | "down" | "left" | "right";

interface FocusNode {
  id: string;
  el: HTMLElement;
  onSelect?: () => void;
}

/**
 * Spatial focus manager — knows which element is "focused" and can move focus
 * in a direction by finding the nearest candidate in that half-plane.
 * Pure class; no React or DOM event listeners here.
 */
export class FocusManager {
  private readonly nodes = new Map<string, FocusNode>();
  private focusedId: string | null = null;
  private readonly listeners = new Set<(id: string | null) => void>();
  onBack?: () => void;

  register(id: string, el: HTMLElement, onSelect?: () => void): () => void {
    this.nodes.set(id, { id, el, onSelect });
    if (this.focusedId === null) this.setFocused(id);
    return () => {
      this.nodes.delete(id);
      if (this.focusedId === id) {
        const next = this.nodes.keys().next().value ?? null;
        this.setFocused(next);
      }
    };
  }

  focus(id: string): void {
    if (this.nodes.has(id)) this.setFocused(id);
  }

  getFocusedId(): string | null {
    return this.focusedId;
  }

  navigate(dir: FocusDirection): void {
    if (!this.focusedId) {
      const first = this.nodes.keys().next().value ?? null;
      if (first) this.setFocused(first);
      return;
    }
    const current = this.nodes.get(this.focusedId);
    if (!current) return;

    const cr = current.el.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;

    let bestId: string | null = null;
    let bestScore = Infinity;

    for (const [id, node] of this.nodes) {
      if (id === this.focusedId) continue;
      const r = node.el.getBoundingClientRect();
      const ox = r.left + r.width / 2;
      const oy = r.top + r.height / 2;
      const dx = ox - cx;
      const dy = oy - cy;

      const inDirection =
        (dir === "up" && dy < 0) ||
        (dir === "down" && dy > 0) ||
        (dir === "left" && dx < 0) ||
        (dir === "right" && dx > 0);
      if (!inDirection) continue;

      // Prefer elements that are directly ahead; penalise lateral offset.
      const primary = dir === "up" || dir === "down" ? Math.abs(dy) : Math.abs(dx);
      const secondary = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy);
      const score = primary + secondary * (secondary / (primary + 1));

      if (score < bestScore) {
        bestScore = score;
        bestId = id;
      }
    }

    if (bestId) this.setFocused(bestId);
  }

  select(): void {
    const node = this.focusedId ? this.nodes.get(this.focusedId) : null;
    node?.onSelect?.();
  }

  back(): void {
    this.onBack?.();
  }

  subscribe(handler: (id: string | null) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  clear(): void {
    this.nodes.clear();
    this.setFocused(null);
  }

  private setFocused(id: string | null): void {
    if (id === this.focusedId) return;
    this.focusedId = id;
    for (const h of this.listeners) h(id);
  }
}
