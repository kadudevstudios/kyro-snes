import type {
  MainMessage,
  PlayerCommand,
  PlayerMessage,
  PlayerSettings,
} from "./protocol";

type Listener = (payload?: unknown) => void;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: number;
}

const DEFAULT_TIMEOUT = 20_000;
const BOOT_TIMEOUT = 120_000;

/**
 * RPC bridge between the app shell and the isolated emulator iframe.
 * Keeping the emulator in its own document means a clean teardown between
 * games and no global collisions with the UI code.
 */
export class PlayerBridge {
  private readonly iframe: HTMLIFrameElement;
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private nextId = 1;
  private disposed = false;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    window.addEventListener("message", this.onMessage);
  }

  private onMessage = (event: MessageEvent): void => {
    if (event.source !== this.iframe.contentWindow) return;
    const data = event.data as PlayerMessage | null;
    if (!data || typeof data !== "object" || typeof data.kind !== "string") return;

    switch (data.kind) {
      case "ready":
        this.emit("ready");
        break;
      case "started":
        this.emit("started");
        break;
      case "progress":
        this.emit("progress", data.text);
        break;
      case "error":
        this.emit("error", data.message);
        break;
      case "reply": {
        const entry = this.pending.get(data.id);
        if (!entry) return;
        window.clearTimeout(entry.timer);
        this.pending.delete(data.id);
        if (data.ok) entry.resolve(data.result);
        else entry.reject(new Error(data.error ?? "Falha no player"));
        break;
      }
      default:
        break;
    }
  };

  on(event: string, listener: Listener): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => set?.delete(listener);
  }

  private emit(event: string, payload?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(payload);
      } catch (error) {
        console.error("[bridge] listener error", error);
      }
    }
  }

  /** Sends the ROM to the iframe and resolves once the runtime is mounted. */
  async boot(rom: ArrayBuffer, gameId: string, gameName: string, settings: PlayerSettings): Promise<void> {
    const ready = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("O runtime do emulador não respondeu a tempo.")),
        BOOT_TIMEOUT,
      );
      const offReady = this.on("ready", () => {
        window.clearTimeout(timer);
        offReady();
        offError();
        resolve();
      });
      const offError = this.on("error", (message) => {
        window.clearTimeout(timer);
        offReady();
        offError();
        reject(new Error(String(message ?? "Erro desconhecido no núcleo")));
      });
    });

    // The iframe may still be loading its module graph when boot() is called.
    await this.waitForDocument();
    const message: MainMessage = {
      kind: "init",
      rom,
      gameId,
      gameName,
      settings,
    };
    this.post(message, [rom]);
    await ready;
  }

  private waitForDocument(): Promise<void> {
    const doc = this.iframe.contentDocument;
    if (doc && doc.readyState === "complete" && doc.getElementById("game")) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = (): void => {
        this.iframe.removeEventListener("load", done);
        resolve();
      };
      this.iframe.addEventListener("load", done);
    });
  }

  call<T = unknown>(cmd: PlayerCommand, payload?: unknown, timeout = DEFAULT_TIMEOUT): Promise<T> {
    if (this.disposed) return Promise.reject(new Error("Player encerrado"));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Tempo esgotado em "${cmd}"`));
      }, timeout);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      const message: MainMessage = { kind: "cmd", id, cmd, payload };
      this.post(message);
    });
  }

  private post(message: MainMessage, transfer: Transferable[] = []): void {
    const target = location.origin === "null" ? "*" : location.origin;
    this.iframe.contentWindow?.postMessage(message, target, transfer);
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener("message", this.onMessage);
    for (const [, entry] of this.pending) {
      window.clearTimeout(entry.timer);
      entry.reject(new Error("Player encerrado"));
    }
    this.pending.clear();
    this.listeners.clear();
  }
}
