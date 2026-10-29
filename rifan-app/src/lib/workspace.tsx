import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session, Snapshot, Row, Entity } from "../model";
export async function api<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "same-origin",
  });
  const body = await response
    .json()
    .catch(() => ({ error: "The server returned an unreadable response" }));
  if (!response.ok)
    throw Object.assign(new Error(body.error || "Request failed"), {
      status: response.status,
    });
  return body;
}
interface Context {
  session: Session;
  snapshot: Snapshot;
  refresh: () => Promise<void>;
  save: (entity: Entity, row: Partial<Row>) => Promise<Row>;
  remove: (entity: Entity, id: string) => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  logout: () => Promise<void>;
  busy: boolean;
  online: boolean;
}
const Workspace = createContext<Context>(null!);
export const useWorkspace = () => useContext(Workspace);
export function WorkspaceProvider({
  session,
  onLogout,
  children,
}: {
  session: Session;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [toast, setToast] = useState<{ message: string; error?: boolean } | null>(
      null,
    );
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api<Snapshot>("/api/snapshot"));
      setError("");
    } catch (e: any) {
      if (e.status === 401) onLogout();
      else {
        setError(e.message);
        throw e;
      }
    }
  }, [onLogout]);
  useEffect(() => {
    refresh().catch(() => {});
    const interval = setInterval(() => {
      if (navigator.onLine) refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [refresh]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const save = async (entity: Entity, row: Partial<Row>) => {
    setBusy(true);
    try {
      const out = await api<Row>(
        `/api/records/${entity}${row.id ? "/" + row.id : ""}`,
        { method: row.id ? "PUT" : "POST", body: JSON.stringify(row) },
      );
      await refresh();
      notify("Saved to your RIFAN workspace");
      return out;
    } catch (e: any) {
      notify(e.message, true);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const remove = async (entity: Entity, id: string) => {
    setBusy(true);
    try {
      await api(`/api/records/${entity}/${id}`, { method: "DELETE" });
      await refresh();
      notify("Record removed");
    } catch (e: any) {
      notify(e.message, true);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!snapshot) return;
    document.title = `${snapshot.settings.appName || "RIFAN Connect"} · Growing together`;
    document.documentElement.style.setProperty(
      "--green",
      snapshot.settings.primaryColor || "#194c2b",
    );
    document.documentElement.dataset.theme = snapshot.settings.theme || "light";
  }, [snapshot?.settings]);
  if (!snapshot)
    return (
      <div className="loading-screen">
        <img src="/rifan-logo.png" alt="RIFAN" />
        <h2>
          {error ? "Unable to load workspace" : "Preparing your workspace…"}
        </h2>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button
              className="button primary"
              onClick={() => refresh().catch(() => {})}
            >
              Try again
            </button>
          </>
        )}
      </div>
    );
  return (
    <Workspace.Provider
      value={{
        session,
        snapshot,
        refresh,
        save,
        remove,
        notify,
        logout: async () => {
          await api("/api/auth/logout", { method: "POST" });
          onLogout();
        },
        busy,
        online,
      }}
    >
      {children}
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast ${toast.error ? "error" : ""}`}
        >
          <span>{toast.error ? "!" : "✓"}</span>
          {toast.message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </Workspace.Provider>
  );
}
