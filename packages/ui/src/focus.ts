export type FocusDirection = "up" | "down" | "left" | "right";

interface FocusNode {
  id: string;
  el: HTMLElement;
  onSelect?: () => void;
  scope: string;
}

interface ScopeFrame {
  scope: string;
  onBack?: () => void;
  prevFocusedId: string | null;
}

const ROOT_SCOPE = "root";

/**
 * Spatial focus manager — knows which element is "focused" and can move focus
 * in a direction by finding the nearest candidate in that half-plane.
 * Pure class; no React or DOM event listeners here.
 *
 * Scopes let a transient layer (e.g. a modal) trap navigation to its own nodes:
 * push a scope when the layer opens, pop it when it closes. Only nodes in the
 * active scope are navigable / selectable, and `back()` routes to the scope's
 * own handler so a controller's B button closes the layer instead of leaving it.
 */
export class FocusManager {
  private readonly nodes = new Map<string, FocusNode>();
  private focusedId: string | null = null;
  private readonly listeners = new Set<(id: string | null) => void>();
  private readonly scopeStack: ScopeFrame[] = [];
  onBack?: () => void;

  private get activeScope(): string {
    return this.scopeStack.length ? this.scopeStack[this.scopeStack.length - 1].scope : ROOT_SCOPE;
  }

  private firstInScope(scope: string): string | null {
    for (const [id, node] of this.nodes) if (node.scope === scope) return id;
    return null;
  }

  register(id: string, el: HTMLElement, onSelect?: () => void, scope = ROOT_SCOPE): () => void {
    this.nodes.set(id, { id, el, onSelect, scope });
    if (this.focusedId === null && scope === this.activeScope) this.setFocused(id);
    return () => {
      this.nodes.delete(id);
      if (this.focusedId === id) this.setFocused(this.firstInScope(this.activeScope));
    };
  }

  /** Open a focus layer: navigation/selection are confined to `scope` until popped. */
  pushScope(scope: string, onBack?: () => void): void {
    this.scopeStack.push({ scope, onBack, prevFocusedId: this.focusedId });
    this.setFocused(this.firstInScope(scope));
  }

  /** Close the topmost focus layer and restore focus to where it was before. */
  popScope(): void {
    const frame = this.scopeStack.pop();
    const restore = frame?.prevFocusedId ?? null;
    const valid =
      restore && this.nodes.has(restore) ? restore : this.firstInScope(this.activeScope);
    this.setFocused(valid);
  }

  focus(id: string): void {
    if (this.nodes.has(id)) this.setFocused(id);
  }

  getFocusedId(): string | null {
    return this.focusedId;
  }

  navigate(dir: FocusDirection): void {
    const scope = this.activeScope;
    if (!this.focusedId) {
      const first = this.firstInScope(scope);
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
      if (id === this.focusedId || node.scope !== scope) continue;
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
    if (node && node.scope === this.activeScope) node.onSelect?.();
  }

  back(): void {
    const top = this.scopeStack[this.scopeStack.length - 1];
    if (top?.onBack) top.onBack();
    else this.onBack?.();
  }

  subscribe(handler: (id: string | null) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  clear(): void {
    this.nodes.clear();
    this.scopeStack.length = 0;
    this.setFocused(null);
  }

  private setFocused(id: string | null): void {
    if (id === this.focusedId) return;
    this.focusedId = id;
    for (const h of this.listeners) h(id);
  }
}
