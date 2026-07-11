/**
 * Transport abstracts "how envelopes get from A to B" so the client and host
 * logic is identical whether we're talking across real iframes (postMessage) or
 * in-memory for tests and the dev harness.
 */
import { isEnvelope, type Envelope } from "./protocol.js";

export interface Transport {
  post(message: Envelope): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: (message: Envelope) => void): () => void;
  dispose(): void;
}

/**
 * Game-side transport: posts to the parent window, listens on this window.
 * Used by a game running inside the shell's iframe.
 */
export function createParentTransport(options: { targetOrigin?: string } = {}): Transport {
  const targetOrigin = options.targetOrigin ?? "*";
  const handlers = new Set<(message: Envelope) => void>();

  const onMessage = (event: MessageEvent) => {
    // Only the embedding shell may drive the lifecycle — not sibling iframes
    // or anything else that can obtain a reference to this window.
    if (event.source !== window.parent) return;
    if (!isEnvelope(event.data)) return;
    for (const handler of handlers) handler(event.data);
  };
  window.addEventListener("message", onMessage);

  return {
    post(message) {
      window.parent.postMessage(message, targetOrigin);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    dispose() {
      window.removeEventListener("message", onMessage);
      handlers.clear();
    },
  };
}

/**
 * Shell-side transport: posts to a target window (the iframe's contentWindow)
 * and only accepts messages originating from that same window.
 */
export function createWindowTransport(
  target: Window,
  options: { targetOrigin?: string } = {},
): Transport {
  const targetOrigin = options.targetOrigin ?? "*";
  const handlers = new Set<(message: Envelope) => void>();

  const onMessage = (event: MessageEvent) => {
    if (event.source !== target) return;
    if (!isEnvelope(event.data)) return;
    for (const handler of handlers) handler(event.data);
  };
  window.addEventListener("message", onMessage);

  return {
    post(message) {
      target.postMessage(message, targetOrigin);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    dispose() {
      window.removeEventListener("message", onMessage);
      handlers.clear();
    },
  };
}

/**
 * A pair of in-memory transports wired to each other. Posting on one delivers to
 * the other's subscribers on the next microtask (async, like real postMessage).
 * Used by the mock harness and tests — no DOM required.
 */
export function createLinkedTransports(): [Transport, Transport] {
  const handlersA = new Set<(message: Envelope) => void>();
  const handlersB = new Set<(message: Envelope) => void>();
  let disposed = false;

  const deliver = (handlers: Set<(message: Envelope) => void>, message: Envelope) => {
    queueMicrotask(() => {
      if (disposed) return;
      for (const handler of handlers) handler(message);
    });
  };

  const transportA: Transport = {
    post: (message) => deliver(handlersB, message),
    subscribe(handler) {
      handlersA.add(handler);
      return () => handlersA.delete(handler);
    },
    dispose() {
      disposed = true;
      handlersA.clear();
      handlersB.clear();
    },
  };

  const transportB: Transport = {
    post: (message) => deliver(handlersA, message),
    subscribe(handler) {
      handlersB.add(handler);
      return () => handlersB.delete(handler);
    },
    dispose() {
      disposed = true;
      handlersA.clear();
      handlersB.clear();
    },
  };

  return [transportA, transportB];
}
