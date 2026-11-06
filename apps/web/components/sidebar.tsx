"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FileText,
  House,
  Keyboard,
  Link2,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  UserRound,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import { api, send } from "@/lib/client-api";

const iconProps = { size: 16, strokeWidth: 1.75, "aria-hidden": true as const };

type Workspace = { id: string; name: string; myRole: string };
type Page = {
  id: string;
  title: string;
  created_at?: string;
  updated_at: string;
};
type User = { id: string; name: string; email: string };
const roleName = (role: string) => role.charAt(0) + role.slice(1).toLowerCase();
const palette = [
  "#E11D48",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#0891B2",
  "#2563EB",
  "#7C3AED",
  "#C026D3",
];
function colorFor(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Sidebar({
  workspace,
  pages,
  user,
  onPagesChange,
  onLogout,
}: {
  workspace: Workspace;
  pages: Page[];
  user: User | null;
  onPagesChange: (pages: Page[]) => void;
  onLogout: () => void;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    workspaceId = workspace.id;
  const [toggleHost, setToggleHost] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [switcher, setSwitcher] = useState(false),
    [switcherPosition, setSwitcherPosition] = useState({ top: 0, left: 0 }),
    [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [userMenu, setUserMenu] = useState(false),
    [userMenuPosition, setUserMenuPosition] = useState({ bottom: 0, left: 0 }),
    [theme, setTheme] = useState("system"),
    [pagesOpen, setPagesOpen] = useState(true),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [editTitle, setEditTitle] = useState(""),
    [menuPage, setMenuPage] = useState<string | null>(null),
    [confirmPage, setConfirmPage] = useState<Page | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const editable = ["OWNER", "ADMIN", "EDITOR"].includes(workspace.myRole);
  const sorted = useMemo(
    () =>
      [...pages].sort(
        (a, b) =>
          Date.parse(b.created_at ?? b.updated_at) -
          Date.parse(a.created_at ?? a.updated_at),
      ),
    [pages],
  );
  useEffect(() => {
    setCollapsed(localStorage.getItem("conflux:sidebar") === "collapsed");
    setPagesOpen(localStorage.getItem("conflux:pagesExpanded") !== "false");
    const savedTheme = localStorage.getItem("conflux:theme") ?? "system";
    setTheme(savedTheme);
    const dark =
      savedTheme === "dark" ||
      (savedTheme === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, []);
  useEffect(() => {
    const updateHost = () => {
      const nextHost = document.querySelector<HTMLElement>(
        ".topbar-sidebar-toggle-slot",
      );
      setToggleHost((current) => (current === nextHost ? current : nextHost));
    };
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    setMobileOpen(false);
    setSwitcher(false);
    setUserMenu(false);
    setMenuPage(null);
  }, [pathname]);
  useEffect(() => {
    if (!searchOpen) return;
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [searchOpen]);
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("conflux:sidebar", next ? "collapsed" : "open");
  }
  function setThemeMode(mode: string) {
    setTheme(mode);
    localStorage.setItem("conflux:theme", mode);
    const dark =
      mode === "dark" ||
      (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
  async function showSwitcher() {
    setSwitcher((value) => !value);
    if (!workspaces.length) {
      const result = await api<{ workspaces: Workspace[] }>(
        "/workspaces",
      ).catch(() => ({ workspaces: [workspace] }));
      setWorkspaces(result.workspaces);
    }
  }
  async function createPage() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { page } = await api<{ page: Page }>(
        `/workspaces/${workspaceId}/pages`,
        send("POST", { title: "" }),
      );
      onPagesChange([page, ...pages]);
      router.push(`/w/${workspaceId}/p/${page.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't create page",
      );
    } finally {
      setBusy(false);
    }
  }
  function beginRename(page: Page) {
    setEditing(page.id);
    setEditTitle(page.title);
    setMenuPage(null);
    requestAnimationFrame(() => {
      const field = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          `[data-rename="${page.id}"]`,
        ),
      ).find((input) => input.offsetParent !== null);
      field?.focus();
      field?.select();
    });
  }
  async function saveRename(page: Page) {
    if (editing !== page.id) return;
    setEditing(null);
    if (editTitle.trim() === page.title) return;
    const before = pages;
    onPagesChange(
      pages.map((item) =>
        item.id === page.id ? { ...item, title: editTitle.trim() } : item,
      ),
    );
    try {
      await api(
        `/pages/${page.id}`,
        send("PATCH", { title: editTitle.trim() }),
      );
    } catch (reason) {
      onPagesChange(before);
      setError(
        reason instanceof Error ? reason.message : "Couldn't rename page",
      );
    }
  }
  async function deletePage() {
    if (!confirmPage) return;
    setBusy(true);
    try {
      await api(`/pages/${confirmPage.id}`, send("DELETE"));
      const remaining = sorted.filter((page) => page.id !== confirmPage.id);
      onPagesChange(remaining);
      if (pathname === `/w/${workspaceId}/p/${confirmPage.id}`)
        router.push(
          remaining[0]
            ? `/w/${workspaceId}/p/${remaining[0].id}`
            : `/w/${workspaceId}`,
        );
      setConfirmPage(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't delete page",
      );
    } finally {
      setBusy(false);
    }
  }
  function rowKey(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? sorted.length - 1
            : Math.max(
                0,
                Math.min(
                  sorted.length - 1,
                  index + (event.key === "ArrowDown" ? 1 : -1),
                ),
              );
      document
        .querySelector<HTMLAnchorElement>(`[data-page-index="${next}"]`)
        ?.focus();
    }
    if (event.key === "F2" && editable) {
      event.preventDefault();
      beginRename(sorted[index]);
    }
    if (
      (event.shiftKey && event.key === "F10") ||
      event.key === "ContextMenu"
    ) {
      event.preventDefault();
      setMenuPage(sorted[index].id);
    }
  }
  const activePageId = sorted.find(
    (page) => pathname === `/w/${workspaceId}/p/${page.id}`,
  )?.id;
  const pageItems = (mobile = false) => (
    <nav aria-label="Pages" role="list" className="page-list">
      {sorted.map((page, index) => (
        <div
          role="listitem"
          className="page-item"
          key={page.id}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuPage(page.id);
          }}
        >
          {editing === page.id ? (
            <input
              data-rename={page.id}
              className="inline-rename"
              aria-label="Rename page"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              onBlur={() => void saveRename(page)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveRename(page);
                }
                if (event.key === "Escape") {
                  setEditing(null);
                  setEditTitle(page.title);
                }
              }}
            />
          ) : (
            <Link
              className="sidebar-row page-row"
              href={`/w/${workspaceId}/p/${page.id}`}
              aria-current={
                pathname === `/w/${workspaceId}/p/${page.id}`
                  ? "page"
                  : undefined
              }
              data-page-index={index}
              tabIndex={page.id === (activePageId ?? sorted[0]?.id) ? 0 : -1}
              onKeyDown={(event) => rowKey(event, index)}
            >
              <span className="row-icon"><FileText {...iconProps} /></span>
              <span
                className="row-label"
                style={{ color: page.title ? undefined : "var(--text-faint)" }}
              >
                {page.title || "Untitled"}
              </span>
            </Link>
          )}
          {(editable || !mobile) && (
            <button
              className="icon-button page-item-actions"
              aria-label={`Actions for ${page.title || "Untitled"}`}
              aria-expanded={menuPage === page.id}
              onClick={() => setMenuPage(menuPage === page.id ? null : page.id)}
            >
              <Ellipsis {...iconProps} />
            </button>
          )}
          {menuPage === page.id && (
            <div className="page-item-menu menu-popover" role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  window.open(
                    `/w/${workspaceId}/p/${page.id}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                  setMenuPage(null);
                }}
              >
                <ArrowUpRight {...iconProps} /> Open in new tab
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${location.origin}/w/${workspaceId}/p/${page.id}`,
                  );
                  setMenuPage(null);
                }}
              >
                <Link2 {...iconProps} /> Copy link
              </button>
              {editable && (
                <>
                  <button role="menuitem" onClick={() => beginRename(page)}>
                    <Pencil {...iconProps} /> Rename <span className="switcher-role">F2</span>
                  </button>
                  <div className="menu-divider" />
                  <button
                    role="menuitem"
                    className="destructive"
                    onClick={() => {
                      setConfirmPage(page);
                      setMenuPage(null);
                    }}
                  >
                    <Trash2 {...iconProps} /> Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
  const sidebar = (
    <aside
      className={`sidebar${collapsed ? " collapsed" : ""}`}
      aria-label="Workspace sidebar"
    >
      <div className="sidebar-header">
        <div className="switcher-wrap">
          <button
            className="switcher-trigger"
            aria-expanded={switcher}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setSwitcherPosition({ top: rect.bottom + 4, left: rect.left });
              void showSwitcher();
            }}
          >
            <span
              className="workspace-avatar"
              style={{ background: colorFor(workspace.id) }}
            >
              {workspace.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="switcher-name">{workspace.name}</span>
            <ChevronDown className="switcher-chevron" {...iconProps} />
          </button>
          {switcher && typeof document !== "undefined" && createPortal(
            <div
              className="switcher-menu menu-popover"
              role="menu"
              style={{ top: switcherPosition.top, left: switcherPosition.left }}
            >
              <div className="menu-label">Workspaces</div>
              <div style={{ maxHeight: 216, overflowY: "auto" }}>
                {workspaces.map((item) => (
                  <button
                    role="menuitem"
                    key={item.id}
                    onClick={() => router.push(`/w/${item.id}`)}
                  >
                    <span
                      className="workspace-avatar"
                      style={{
                        width: 20,
                        height: 20,
                        background: colorFor(item.id),
                      }}
                    >
                      {item.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="row-label">{item.name}</span>
                    <span className="switcher-role">
                      {roleName(item.myRole)}
                    </span>
                    {item.id === workspaceId && (
                      <Check {...iconProps} style={{ color: "var(--accent)" }} />
                    )}
                  </button>
                ))}
              </div>
              <div className="menu-divider" />
              <button
                role="menuitem"
                onClick={() => router.push("/onboarding")}
              >
                <Plus {...iconProps} /> Create workspace
              </button>
              {["OWNER", "ADMIN"].includes(workspace.myRole) && (
                <>
                  <button
                    role="menuitem"
                    onClick={() =>
                      router.push(`/w/${workspaceId}/settings/members`)
                    }
                  >
                    <UserRoundPlus {...iconProps} /> Invite members
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => router.push(`/w/${workspaceId}/settings`)}
                  >
                    <Settings {...iconProps} /> Workspace settings
                  </button>
                </>
              )}
            </div>,
            document.body,
          )}
        </div>
        <button
          className="icon-button collapse-button"
          aria-label="Close sidebar (⌘ \\)"
          title="Close sidebar　⌘ \\"
          onClick={toggleSidebar}
        >
          <PanelLeftClose {...iconProps} />
        </button>
        <button
          className="icon-button mobile-close"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
        >
          <X {...iconProps} />
        </button>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-rows">
          <button className="sidebar-row" onClick={() => setSearchOpen(true)}>
            <span className="row-icon"><Search {...iconProps} /></span>
            <span className="row-label">Search</span>
            <kbd className="kbd">⌘K</kbd>
          </button>
          <Link
            className="sidebar-row"
            href={`/w/${workspaceId}`}
            aria-current={pathname === `/w/${workspaceId}` ? "page" : undefined}
          >
            <span className="row-icon"><House {...iconProps} /></span>
            <span className="row-label">Home</span>
          </Link>
        </div>
      </div>
      <div className="sidebar-pages-heading">
        <button
          onClick={() => {
            const next = !pagesOpen;
            setPagesOpen(next);
            localStorage.setItem("conflux:pagesExpanded", String(next));
          }}
          aria-expanded={pagesOpen}
        >
          <span className={`pages-chevron${pagesOpen ? " expanded" : ""}`}>
            <ChevronRight size={12} strokeWidth={1.75} aria-hidden="true" />
          </span>
          Pages
        </button>
        {editable && (
          <button
            className="icon-button new-page-icon"
            aria-label="New page"
            title="New page"
            onClick={() => void createPage()}
          >
            <Plus {...iconProps} />
          </button>
        )}
      </div>
      {pagesOpen && pageItems()}
      {error && (
        <div className="muted" style={{ fontSize: 12, padding: "4px 12px" }}>
          {error}{" "}
          <button className="quiet" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      <div className="sidebar-secondary">
        <Link
          className="sidebar-row"
          href={`/w/${workspaceId}/settings/members`}
          aria-current={pathname.endsWith("/members") ? "page" : undefined}
        >
          <span className="row-icon"><UsersRound {...iconProps} /></span>
          <span className="row-label">Members</span>
        </Link>
        {["OWNER", "ADMIN"].includes(workspace.myRole) && (
          <Link
            className="sidebar-row"
            href={`/w/${workspaceId}/settings`}
            aria-current={pathname.endsWith("/settings") ? "page" : undefined}
          >
            <span className="row-icon"><Settings {...iconProps} /></span>
            <span className="row-label">Settings</span>
          </Link>
        )}
      </div>
      <div className="sidebar-footer">
        <button
          className="user-trigger"
          aria-expanded={userMenu}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setUserMenuPosition({
              bottom: window.innerHeight - rect.top + 8,
              left: rect.left,
            });
            setUserMenu(!userMenu);
          }}
        >
          <span
            className="user-avatar"
            style={{ background: colorFor(user?.id ?? "user") }}
          >
            {initials(user?.name ?? "User")}
          </span>
          <span className="user-trigger-text">
            <span className="user-trigger-name">
              {user?.name ?? "Your account"}
            </span>
            <span className="user-trigger-role">
              {roleName(workspace.myRole)}
            </span>
          </span>
          <ChevronDown className="switcher-chevron user-menu-chevron" {...iconProps} />
        </button>
        {userMenu && typeof document !== "undefined" && createPortal(
          <div
            className="sidebar-menu menu-popover"
            style={{ bottom: userMenuPosition.bottom, left: userMenuPosition.left }}
          >
            <div className="menu-user">
              <span
                className="user-avatar"
                style={{
                  width: 32,
                  height: 32,
                  background: colorFor(user?.id ?? "user"),
                }}
              >
                {initials(user?.name ?? "User")}
              </span>
              <span>
                <span className="menu-user-name">
                  {user?.name ?? "Your account"}
                </span>
                <br />
                <span className="menu-user-email">{user?.email}</span>
              </span>
            </div>
            <div className="menu-divider" />
            <button
              onClick={() => router.push(`/w/${workspaceId}/settings/profile`)}
            >
              <UserRound {...iconProps} /> Profile
            </button>
            <div className="theme-row">
              <span>Theme</span>
              <div className="theme-segment">
                {[
                  ["light", <Sun {...iconProps} />],
                  ["dark", <Moon {...iconProps} />],
                  ["system", <Monitor {...iconProps} />],
                ].map(([name, icon]) => (
                  <button
                    key={name}
                    className={theme === name ? "selected" : ""}
                    aria-label={`${name} theme`}
                    aria-pressed={theme === name}
                    onClick={() => setThemeMode(name)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                setUserMenu(false);
                setSearchOpen(true);
              }}
            >
              <Keyboard {...iconProps} /> Keyboard shortcuts <span className="switcher-role">⌘/</span>
            </button>
            <div className="menu-divider" />
            <button onClick={onLogout}><LogOut {...iconProps} /> Log out</button>
          </div>,
          document.body,
        )}
      </div>
    </aside>
  );
  const filtered = sorted.filter((page) =>
    page.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <button
        className="icon-button mobile-sidebar-toggle"
        aria-label="Open sidebar"
        onClick={() => setMobileOpen(true)}
      >
        <Menu {...iconProps} />
      </button>
      {sidebar}
      {mobileOpen && (
        <div
          className="mobile-drawer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileOpen(false);
          }}
        >
          {sidebar}
        </div>
      )}
      {collapsed && toggleHost && createPortal(
        <button
          className="icon-button desktop-sidebar-toggle"
          aria-label="Open sidebar (⌘ \\)"
          title="Open sidebar　⌘ \\"
          onClick={toggleSidebar}
        >
          <PanelLeftOpen {...iconProps} />
        </button>,
        toggleHost,
      )}
      {searchOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false);
          }}
        >
          <section
            className="quick-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search pages"
          >
            <div className="quick-input-wrap">
              <Search {...iconProps} />
              <input
                autoFocus
                placeholder="Search pages…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                  if (event.key === "Enter" && filtered[0]) {
                    router.push(`/w/${workspaceId}/p/${filtered[0].id}`);
                    setSearchOpen(false);
                  }
                }}
              />
            </div>
            <div className="quick-results">
              {filtered.map((page) => (
                <Link
                  key={page.id}
                  href={`/w/${workspaceId}/p/${page.id}`}
                  onClick={() => setSearchOpen(false)}
                >
                  <FileText {...iconProps} /> {page.title || "Untitled"}
                </Link>
              ))}
              {!filtered.length && (
                <p className="muted" style={{ padding: 8 }}>
                  No pages found
                </p>
              )}
              {editable && (
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    void createPage();
                  }}
                >
                  <Plus {...iconProps} /> New page
                </button>
              )}
              <Link
                href={`/w/${workspaceId}/settings/members`}
                onClick={() => setSearchOpen(false)}
              >
                <UsersRound {...iconProps} /> Go to members
              </Link>
            </div>
          </section>
        </div>
      )}
      {confirmPage && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmPage(null);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true">
            <h2>Delete “{confirmPage.title || "Untitled"}”?</h2>
            <p className="muted">
              This page and its comments and version history will be permanently
              deleted.
            </p>
            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => setConfirmPage(null)}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() => void deletePage()}
              >
                {busy ? "Deleting…" : "Delete page"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

