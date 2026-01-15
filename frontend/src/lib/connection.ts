export type ConnState = "ok" | "reconnecting" | "down" | "auth";

type Listener = (s: ConnState, msg?: string) => void;
let state: ConnState = "ok";
let message: string | undefined;
const listeners = new Set<Listener>();

export function getConnection() { return { state, message }; }

export function setConnection(next: ConnState, msg?: string) {
  state = next; message = msg;
  listeners.forEach(fn => fn(state, message));
}

export function onConnectionChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
