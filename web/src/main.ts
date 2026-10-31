import "./styles/main.css";
import { App } from "./ui/app";
import { toast } from "./ui/toast";

async function bootstrap(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) throw new Error("Elemento raiz ausente.");

  const app = new App(root);
  await app.init();

  // Small hook used by the automated tests and for debugging in the console.
  (window as unknown as { kyroApp: App }).kyroApp = app;

  document.documentElement.classList.add("is-ready");
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  const fatal = document.getElementById("boot-fatal");
  if (fatal) {
    fatal.hidden = false;
    fatal.textContent = `Falha ao iniciar: ${message}`;
  }
  toast("Falha ao iniciar o aplicativo.", "error", 8000);
});
