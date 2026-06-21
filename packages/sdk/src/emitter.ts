/**
 * A tiny typed listener set: add() returns an unsubscribe fn, emit() fans out,
 * clear() drops all. Replaces the hand-rolled add/return-delete closures the
 * client and host previously each re-implemented.
 */
export class Emitter<Args extends unknown[] = []> {
  private readonly listeners = new Set<(...args: Args) => void>();

  add(listener: (...args: Args) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(...args: Args): void {
    for (const listener of this.listeners) listener(...args);
  }

  clear(): void {
    this.listeners.clear();
  }
}
