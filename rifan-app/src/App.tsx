import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MapPinned,
  CalendarDays,
  Building2,
  Warehouse,
  Sprout,
  Upload,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings,
  UserRound,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
  LogOut,
  HelpCircle,
  Plus,
  PanelLeftClose,
  Wallet,
  Wheat,
  Bot,
  ArrowRight,
  WifiOff,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace, api } from "./lib/workspace";
import type { Session } from "./model";
import { canEdit } from "./model";
import Auth from "./pages/Auth";
import { Modal } from "./components/ui";
const CardPrint = lazy(() => import("./pages/CardPrint"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Farmers = lazy(() => import("./pages/Farmers"));
const FarmerProfile = lazy(() => import("./pages/FarmerProfile"));
const EntityPage = lazy(() => import("./pages/EntityPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const Calendar = lazy(() => import("./pages/Calendar"));
const DataHub = lazy(() => import("./pages/DataHub"));
const Reports = lazy(() => import("./pages/Reports"));
const Membership = lazy(() => import("./pages/Membership"));
const Advisor = lazy(() => import("./pages/Advisor"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const UsersPage = lazy(() => import("./pages/Users"));
const Profile = lazy(() => import("./pages/Profile"));
const Activity = lazy(() => import("./pages/Activity"));
const Alerts = lazy(() => import("./pages/Alerts"));
const FoodBank = lazy(() => import("./pages/FoodBank"));
const Connections = lazy(() => import("./pages/Connections"));
const groups = [
  {
    name: "WORKSPACE",
    items: [
      { name: "Overview", path: "/", icon: LayoutDashboard },
      { name: "Members & fees", path: "/membership", icon: Wallet },
    ],
  },
  {
    name: "FARMERS & FIELD OPERATIONS",
    items: [
      { name: "Farmer registry", path: "/farmers", icon: Users },
      {
        name: "Farm intelligence",
        path: "/map",
        icon: MapPinned,
        feature: "enableMap",
      },
      { name: "Harvest planner", path: "/calendar", icon: CalendarDays },
      {
        name: "Programmes & impact",
        path: "/monitoring",
        icon: Sprout,
        feature: "enableMonitoring",
      },
      { name: "Farm advisor", path: "/advisor", icon: Bot },
    ],
  },
  {
    name: "FOOD SECURITY",
    items: [
      {
        name: "Food bank",
        path: "/food-bank",
        icon: Wheat,
        feature: "enableFoodBank",
      },
      {
        name: "Warehouses",
        path: "/warehouses",
        icon: Warehouse,
        feature: "enableFoodBank",
      },
      { name: "Cooperatives", path: "/orgs", icon: Building2 },
    ],
  },
  {
    name: "DATA & REPORTS",
    items: [
      { name: "Data hub", path: "/upload", icon: Upload },
      {
        name: "Reports & insights",
        path: "/reports",
        icon: ChartNoAxesCombined,
      },
      { name: "Connections", path: "/connections", icon: ArrowUpRight },
    ],
  },
  {
    name: "ADMINISTRATION",
    items: [
      { name: "Team & access", path: "/users", icon: ShieldCheck, admin: true },
      {
        name: "Audit trail",
        path: "/activity",
        icon: ShieldCheck,
        feature: "enableActivityLog",
        audit: true,
      },
      { name: "Settings", path: "/settings", icon: Settings, admin: true },
    ],
  },
];
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true);
  const clear = useCallback(() => setSession(null), []);
  useEffect(() => {
    api<Session>("/api/auth/me")
      .then(setSession)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return (
      <div className="loading-screen">
        <img src="/rifan-logo.png" alt="RIFAN" />
        <p>Opening RIFAN Connect…</p>
      </div>
    );
  if (!session) return <Auth onLogin={setSession} />;
  return (
    <BrowserRouter>
      <WorkspaceProvider session={session} onLogout={clear}>
        <Routes>
          <Route
            path="/print/cards"
            element={
              <Suspense
                fallback={
                  <div className="loading-screen">Preparing print sheet…</div>
                }
              >
                <CardPrint />
              </Suspense>
            }
          />
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="farmers" element={<Farmers />} />
            <Route path="farmers/:id" element={<FarmerProfile />} />
            <Route path="membership" element={<Membership />} />
            <Route
              path="orgs"
              element={<EntityPage entity="organizations" />}
            />
            <Route path="programs" element={<EntityPage entity="programs" />} />
            <Route
              path="warehouses"
              element={<EntityPage entity="warehouses" />}
            />
            <Route
              path="monitoring"
              element={<EntityPage entity="interventions" />}
            />
            <Route path="map" element={<MapPage />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="upload" element={<DataHub />} />
            <Route path="reports" element={<Reports />} />
            <Route path="connections" element={<Connections />} />
            <Route path="food-bank" element={<FoodBank />} />
            <Route path="advisor" element={<Advisor />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="profile" element={<Profile />} />
            <Route path="activity" element={<Activity />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Page not found</h1>
                  <Link className="button primary" to="/">
                    Return to overview
                  </Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
function Shell() {
  const { session, snapshot, online, logout } = useWorkspace();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [tour, setTour] = useState(false);
  const loc = useLocation(),
    navigate = useNavigate();
  useEffect(() => {
    setOpen(false);
    document.getElementById("workspace-main")?.scrollTo(0, 0);
  }, [loc.pathname]);
  const alertCount = snapshot.data.alerts.filter(
    (a) => a.status !== "Resolved",
  ).length;
  const active = groups
    .flatMap((g) => g.items)
    .find((i) => i.path === loc.pathname);
  const matches = search
    ? groups
        .flatMap((g) => g.items)
        .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 5)
    : [];
  return (
    <div className="app-shell">
      <a href="#workspace-main" className="skip-link">
        Skip to content
      </a>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link to="/" className="brand">
          <img
            src={snapshot.settings.logo || "/rifan-logo.png"}
            alt="RIFAN emblem"
          />
          <div>
            <strong>
              RIFAN <span>Connect</span>
            </strong>
            <small>MEMBERSHIP & FARM MANAGEMENT</small>
          </div>
        </Link>
        <button className="workspace-switch" onClick={() => setTour(true)}>
          <div className="workspace-avatar">
            <Wheat size={17} />
          </div>
          <div>
            <strong>National workspace</strong>
            <span>
              {session.demo
                ? "Demonstration environment"
                : "Rice Farmers Association of Nigeria"}
            </span>
          </div>
          <ChevronDown size={15} />
        </button>
        <nav aria-label="Main navigation">
          {groups.map((g) => {
            const visible = g.items.filter(
              (i) =>
                (!("feature" in i) || snapshot.settings[i.feature!]) &&
                (!("admin" in i) ||
                  ["Super Admin", "Admin"].includes(session.role)) &&
                (!("audit" in i) ||
                  ["Super Admin", "Admin", "Manager"].includes(session.role)),
            );
            if (!visible.length) return null;
            return (
              <div className="nav-group" key={g.name}>
                <div className="nav-label">{g.name}</div>
                {visible.map((i) => (
                  <NavLink
                    end={i.path === "/"}
                    to={i.path}
                    key={i.path}
                    className={({ isActive }) => (isActive ? "active" : "")}
                  >
                    <i.icon size={18} strokeWidth={1.7} />
                    <span>{i.name}</span>
                    {i.path === "/membership" && (
                      <span className="nav-tag">NEW</span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="sidebar-help" onClick={() => setTour(true)}>
            <HelpCircle size={17} />
            Workspace guide
            <ArrowUpRight size={14} />
          </button>
          <button className="user-tile" onClick={() => navigate("/profile")}>
            <div className="avatar">
              {session.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <strong>{session.name}</strong>
              <small>{session.role}</small>
            </div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(!open)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <span>
              {active?.name ||
                (loc.pathname.startsWith("/farmers/")
                  ? "Member profile"
                  : loc.pathname === "/alerts"
                    ? "Alerts"
                    : loc.pathname === "/profile"
                      ? "My account"
                      : "Workspace")}
            </span>
          </div>
          <div className="topbar-right">
            <div className="global-search">
              <Search size={16} />
              <input
                aria-label="Search workspace pages"
                placeholder="Find something…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>/</kbd>
              {search && (
                <div className="search-results">
                  {matches.length ? (
                    matches.map((m) => (
                      <button
                        key={m.path}
                        onClick={() => {
                          navigate(m.path);
                          setSearch("");
                        }}
                      >
                        <m.icon size={16} />
                        {m.name}
                        <ArrowUpRight size={14} />
                      </button>
                    ))
                  ) : (
                    <p>No pages found</p>
                  )}
                </div>
              )}
            </div>
            <span className="country-label">
              <span className="nigeria-flag" />
              Nigeria
            </span>
            <Link
              className="icon-button notification-button"
              to="/alerts"
              aria-label={`${alertCount} open alerts`}
            >
              <Bell size={19} />
              {alertCount > 0 && <b />}
            </Link>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => logout()}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {session.demo && (
          <div className="demo-banner">
            <span>
              <span className="status-dot" />
              DEMO WORKSPACE
            </span>
            <p>
              Explore with sample data. Your production records are separate.
            </p>
            <button onClick={() => logout()}>
              Create your workspace <ArrowRight size={13} />
            </button>
          </div>
        )}
        {!online && (
          <div role="alert" className="offline-banner">
            <WifiOff size={16} />
            You are offline. Previously loaded records remain visible; reconnect
            before saving.
          </div>
        )}
        <main id="workspace-main" tabIndex={-1} className="workspace-content">
          <div
            className="page-watermark"
            aria-hidden="true"
            style={{
              backgroundImage: `url(${JSON.stringify(snapshot.settings.logo || "/rifan-logo.png")})`,
            }}
          />
          <div className="page-content">
            <Suspense
              fallback={<div className="loading-block">Opening module…</div>}
            >
              <Outlet />
            </Suspense>
            <footer className="workspace-footer">
              <span>
                RIFAN Connect <span>·</span> Growing together. Feeding a nation.
              </span>
              <span>
                <span className="status-dot" />
                {online ? "Workspace connected" : "Offline"} <span>·</span>{" "}
                {new Date().getFullYear()}
              </span>
            </footer>
          </div>
        </main>
      </div>
      {tour && (
        <Modal title="Your RIFAN workspace" onClose={() => setTour(false)}>
          <p>
            Follow the farmer journey from registration to a successful harvest.
          </p>
          <div className="guide-steps">
            {[
              [
                "01",
                "Register & verify",
                "Add members in the Farmer registry, or validate and import a spreadsheet in Data hub.",
              ],
              [
                "02",
                "Manage membership",
                "Review applications and record fees in Members & fees. An administrator verifies each payment.",
              ],
              [
                "03",
                "Support the field",
                "Enroll members in programmes, log interventions and plan harvests with your field team.",
              ],
              [
                "04",
                "Aggregate & measure",
                "Record grain receipts and dispatches, review impact, and export reports.",
              ],
              [
                "05",
                "Connect the farmer website",
                "The registration API and fee records are prepared. Public registration and online payment collection are disabled until configured.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <b>{n}</b>
                <section>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </section>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button className="button primary" onClick={() => setTour(false)}>
              Let’s get growing <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
