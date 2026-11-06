# Conflux — Frontend Specification (MVP)

Audience: the coding agent implementing `apps/web` (Next.js + TypeScript). All product, UX and design decisions are made in this document. Implement as written. Where a decision is genuinely missing, it is listed in **Section 16 (Backend gaps & assumptions)**. Follow those assumptions rather than stopping to ask.

---

## 1. Product feel and design principles

Conflux = **Notion's calm, content-first canvas + Google Docs' familiarity and discoverability.**

- **Calm canvas:** the document is the hero. Chrome (sidebar, top bar, toolbar) is quiet, low-contrast, and gets out of the way. No heavy borders, no shadows except on floating layers (menus, dialogs).
- **Docs-like discoverability:** a slim fixed formatting toolbar, familiar shortcuts, a visible Share button, comments in the right margin, a clear version history.
- **Notion-like speed:** slash menu (`/`) for inserting blocks, `⌘K` quick switcher, inline-editable title, flat sidebar page list with hover actions.
- **Simple by default:** one obvious action per screen. Never more than one primary button visible. No settings the MVP does not need.
- **Trust signals:** always show save/sync state, who is here, and what role the current user has.
- **Motion:** subtle only (120–180ms ease-out). Respect `prefers-reduced-motion`.

---

## 2. Tech stack (frontend)

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript strict |
| Styling | Tailwind CSS + CSS variables for tokens |
| Components | shadcn/ui (Radix primitives) — Dialog, DropdownMenu, Popover, Tooltip, Tabs, Select, Avatar, Command, Sheet, Skeleton, Toast (Sonner) |
| Icons | lucide-react |
| Fonts | Via `next/font/google`: **Geist** (UI and editor body, variable weight), **Instrument Serif** (page title and Workspace home heading only), **Geist Mono** (code). Expose as CSS variables `--font-sans`, `--font-serif`, `--font-mono`. Fallbacks: `ui-sans-serif, system-ui, sans-serif` / `ui-serif, Georgia, serif` / `ui-monospace, SFMono-Regular, monospace`. Set `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility` on `body`. |
| Editor | **Tiptap** (ProseMirror-based) with `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor` (or `-caret`), `y-prosemirror` |
| Realtime | `yjs`, `y-websocket` (`WebsocketProvider`), `y-indexeddb` (offline cache, P1) |
| Server state | TanStack Query |
| UI state | Zustand (small: sidebar open, panel open, quick switcher) |
| Forms | react-hook-form + zod |
| Theme | next-themes (light / dark / system) |
| Dates | date-fns |

Types shared with backend come from `packages/shared`. Do not redefine DTOs locally.

---

## 3. Design tokens

Define as CSS variables in `globals.css`, mapped into the Tailwind config. Provide light and dark values.

### Colors (light)
- `--bg`: `#FFFFFF` — app and editor background
- `--bg-subtle`: `#F7F7F5` — sidebar, hover fills
- `--bg-muted`: `#EFEFEC` — pressed/selected fills
- `--border`: `#E8E8E4`
- `--text`: `#1F1F1D`
- `--text-muted`: `#6B6B66`
- `--text-faint`: `#9A9A94`
- `--accent`: `#4F46E5` (indigo) — primary buttons, links, focus ring, active states
- `--accent-hover`: `#4338CA`
- `--accent-subtle`: `#EEF0FF`
- `--danger`: `#DC2626`, `--success`: `#16A34A`, `--warning`: `#D97706`
- `--comment-highlight`: `#FFF3C4` (inactive), `#FFE58A` (active/selected thread)

### Colors (dark)
- `--bg`: `#191919`, `--bg-subtle`: `#202020`, `--bg-muted`: `#2A2A2A`, `--border`: `#2F2F2F`
- `--text`: `#ECECEA`, `--text-muted`: `#A3A39E`, `--text-faint`: `#75756F`
- `--accent`: `#818CF8`, `--accent-subtle`: `#262846`
- `--comment-highlight`: `#4A3F12`, active `#6B5A14`

### Collaborator colors (cursors and avatars)
Deterministic palette of 8, assigned by hash of `userId`:
`#E11D48, #EA580C, #CA8A04, #16A34A, #0891B2, #2563EB, #7C3AED, #C026D3`

### Extra tokens
- `--hover`: `rgba(15,15,15,0.045)` light, `rgba(255,255,255,0.055)` dark. Used for hover fills on rows and ghost buttons (translucent so it works on any background).
- `--pressed`: `rgba(15,15,15,0.08)` light, `rgba(255,255,255,0.09)` dark.
- `--ring`: `--accent` at 100%; `--ring-soft`: `--accent` at 20% (used for the 3px halo on focused inputs).
- `--overlay`: `rgba(15,15,15,0.40)` light, `rgba(0,0,0,0.60)` dark.
- Borders are always **1px hairlines**. Never use 2px borders for structure.

### Elevation (shadows)
Only floating layers get a shadow. Light theme values (dark theme: same offsets, black at 40–55% opacity, plus a 1px inner border `rgba(255,255,255,0.06)`):
- `--shadow-xs`: `0 1px 2px rgba(15,15,15,0.05)` — secondary buttons, inputs
- `--shadow-md`: `0 4px 12px rgba(15,15,15,0.08), 0 0 0 1px rgba(15,15,15,0.06)` — dropdowns, popovers, tooltips, slash menu
- `--shadow-lg`: `0 16px 40px rgba(15,15,15,0.14), 0 0 0 1px rgba(15,15,15,0.06)` — dialogs, quick switcher

### Typography
Families per Section 2. Weights available: 400 (regular), 500 (medium), 600 (semibold). Do not use 700 anywhere.

| Role | Font | Size / line-height | Weight | Letter-spacing | Color |
|---|---|---|---|---|---|
| UI body (sidebar rows, menus, inputs) | Geist | 14 / 20 | 400 | 0 | `--text` or `--text-muted` |
| UI label / button text | Geist | 14 / 20 | 500 | 0 | per component |
| Secondary text | Geist | 13 / 18 | 400 | 0 | `--text-muted` |
| Caption / meta | Geist | 12 / 16 | 400 | 0.005em | `--text-faint` |
| Overline (menu group labels) | Geist | 11 / 16 | 500 | 0.04em, uppercase | `--text-faint` |
| Editor body | Geist | 16 / 1.65 | 400 | -0.003em | `--text` |
| Editor H1 | Geist | 30 / 1.25 | 600 | -0.02em | `--text` |
| Editor H2 | Geist | 24 / 1.3 | 600 | -0.015em | `--text` |
| Editor H3 | Geist | 19 / 1.4 | 600 | -0.01em | `--text` |
| **Page title** (above editor) | **Instrument Serif** | 48 / 1.1 (40 / 1.12 below md) | 400 | -0.01em | `--text` |
| Workspace home heading | Instrument Serif | 40 / 1.1 | 400 | -0.01em | `--text` |
| Code (inline and block) | Geist Mono | 0.9em of surrounding text (block: 14 / 1.6) | 400 | 0 | `--text` |

Instrument Serif only ships weight 400. Never apply bold to it (set `font-synthesis: none` on elements using it).

### Layout and shape
- Radius scale: `--radius-sm` 4px (small icon buttons, kbd chips, inline code), `--radius-md` 6px (sidebar rows, toolbar buttons, menu items), `--radius-lg` 8px (inputs, buttons, dropdown/popover containers), `--radius-xl` 12px (dialogs, cards, quick switcher). Avatars are fully round except workspace avatars (radius 6px).
- Spacing scale: Tailwind default (4px grid). Never use odd values like 5px or 7px.
- Sidebar width **264px** (collapsible to 0). Comments/History panel width 340px. Editor content max-width 720px, centered, horizontal padding 24px (48px ≥ md).
- Focus: 2px ring in `--accent`, offset 2px, always visible for keyboard users (use `:focus-visible`, not `:focus`). Inside tight containers (sidebar rows, toolbar) use an **inset** 2px ring instead so it is never clipped.

### Base component specs
Build these once as the shadcn primitives (edit the generated files to match) so every screen inherits them.

**Button** — font 14/500, radius 8px, no uppercase, icon 16px with 8px gap, transitions `background-color, border-color, box-shadow` 120ms ease-out. Sizes: `sm` height 28 / padding 0 10; `md` (default) height 32 / padding 0 12; `lg` height 40 / padding 0 16 (auth forms and onboarding only).
- *Primary:* bg `--accent`, text white; hover `--accent-hover`; pressed: add `inset 0 1px 2px rgba(0,0,0,0.15)`; disabled opacity 0.5.
- *Secondary:* bg `--bg`, 1px `--border`, `--shadow-xs`, text `--text`; hover bg `--bg-subtle`; pressed bg `--bg-muted`.
- *Ghost:* transparent, text `--text-muted`; hover bg `--hover` and text `--text`; pressed `--pressed`.
- *Danger:* bg `--danger`, text white (only inside confirm dialogs and the Danger zone).
- *Icon button:* square (24 / 28 / 32), radius 6px, ghost styling, icon 16px (14px at size 24).
- Loading: replace the leading icon with a 14px spinner, keep the label, disable pointer events, keep width stable.

**Input / Textarea / Select** — height 36px (`lg`: 40px), radius 8px, padding 0 12px, 1px `--border`, bg `--bg`, `--shadow-xs`, text 14/20, placeholder `--text-faint`. Hover: border `--text-faint` at 50%. Focus: border `--accent` plus a 3px `--ring-soft` halo (no outline). Error: border `--danger`, halo `--danger` at 20%, message below in 13px `--danger` with 6px gap. Labels sit above, 13/500 `--text`, 6px gap; helper text 13px `--text-muted`. Textarea min-height 80px, padding 8px 12px.

**Dropdown menu / Popover / Context menu** — bg `--bg`, 1px `--border` via `--shadow-md`, radius 8px, padding 4px, min-width 180px. Items: height 32px, radius 6px, padding 0 8px, gap 8px, icon 16px `--text-muted`, label 14px `--text`, optional right-aligned shortcut in 12px `--text-faint`. Highlighted (hover/keyboard) item bg `--hover`. Destructive item label `--danger`, highlighted bg `--danger` at 8%. Separators: 1px `--border`, margin 4px -4px (full-bleed). Group label: Overline style, padding 8px 8px 4px. Open/close animation: 120ms fade + 4px translate from the anchor side, scale 0.98 → 1.

**Tooltip** — bg `--text` (inverted), text `--bg`, 12/16 weight 500, padding 4px 8px, radius 6px, `--shadow-md`, max-width 240px. Delay 400ms open, 0ms when moving between tooltips. Shortcuts shown as a trailing `Kbd` chip at 70% opacity. Never put essential information only in a tooltip.

**Dialog** — overlay `--overlay` with `backdrop-filter: blur(2px)`; panel bg `--bg`, radius 12px, `--shadow-lg`, width 440px (480px for Share, 560px for Profile), max-width calc(100vw - 32px), padding 24px. Title 18/600 (Geist), description 14px `--text-muted` below with 4px gap, 20px gap before content, footer buttons right-aligned with 8px gap and 24px gap above. Close "x" icon button (28px) at top-right 12px/12px. Enter animation: 160ms fade + scale 0.97 → 1. On mobile (< 640px) dialogs become bottom sheets with radius 16px top corners.

**Avatar** — sizes 20, 24, 28, 32, 40 (round). Image fills; fallback shows 1–2 uppercase initials in Geist 500, font-size = 42% of the avatar size, white text on a background color picked from the collaborator palette by hash of `userId` (so a user has the same color everywhere). Workspace avatar: same, radius 6px (radius 5px at size 20), initial is one letter.

**Badge / chip** — height 20px, padding 0 6px, radius 4px, 12/500; neutral bg `--bg-muted` text `--text-muted`; accent bg `--accent-subtle` text `--accent`; warning/danger use their color at 12% bg with full-color text.

**Kbd chip** — height 18px, min-width 18px, padding 0 4px, radius 4px, 1px `--border`, bg `--bg`, Geist Mono 11/500 `--text-muted`. Show `⌘` on macOS and `Ctrl` elsewhere (detect via `navigator.platform`).

**Toast (Sonner)** — bottom-center, width 360px, bg `--bg`, 1px `--border`, `--shadow-md`, radius 10px, padding 12px 14px, title 14/500, description 13 `--text-muted`, 16px leading status icon, auto-dismiss 4s (6s for errors, with a close button). Max 3 stacked.

**Skeleton** — bg `--bg-muted`, radius 6px, shimmer: a linear-gradient highlight (`--hover` → transparent) sweeping left→right over 1.4s, infinite; disabled under `prefers-reduced-motion` (static fill).

**Scrollbars** (all scroll containers): 8px wide, transparent track, thumb `--border` with radius 4px and 2px transparent padding; thumb darkens to `--text-faint` at 40% on hover; thumb is hidden until the container is hovered or scrolling (use `scrollbar-width: thin; scrollbar-color` plus `::-webkit-scrollbar` rules).

---

## 4. Route map (App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── invite/[token]/page.tsx              # public-ish: works logged-in or out
├── (app)/                               # requires auth; wraps with AppShell
│   ├── page.tsx                         # redirect logic (see below)
│   ├── onboarding/page.tsx              # create first workspace
│   └── w/[workspaceId]/
│       ├── layout.tsx                   # sidebar + workspace context
│       ├── page.tsx                     # workspace home (page list)
│       ├── p/[pageId]/page.tsx          # editor page
│       └── settings/
│           ├── page.tsx                 # General
│           └── members/page.tsx         # Members & invitations
├── not-found.tsx
└── layout.tsx                           # providers: Query, Theme, Toaster
```

**Root redirect (`/`):** unauthenticated → `/login`. Authenticated with 0 workspaces → `/onboarding`. Otherwise → last visited workspace (stored in `localStorage` key `conflux:lastWorkspace`), falling back to the first workspace returned.

**Route protection:** Next.js `middleware.ts` checks for the session cookie and redirects to `/login?next=<path>`. After login/register, honor `next`. The `(app)` layout also calls `GET /auth/me`. A 401 anywhere in the app clears the session and redirects to login.

There is no marketing/landing page in MVP.

---

## 5. Roles and permission matrix (UI behavior)

The workspace response must include `myRole`. The UI derives capabilities from it with a single helper `can(role, action)` in `lib/permissions.ts`.

| Action | Viewer | Commenter | Editor | Admin | Owner |
|---|---|---|---|---|---|
| Read pages | ✓ | ✓ | ✓ | ✓ | ✓ |
| Add/reply/resolve comments | ✗ | ✓ | ✓ | ✓ | ✓ |
| Edit own comments / delete own | ✗ | ✓ | ✓ | ✓ | ✓ |
| Delete others' comments | ✗ | ✗ | ✗ | ✓ | ✓ |
| Edit document body and title | ✗ | ✗ | ✓ | ✓ | ✓ |
| Create / delete pages | ✗ | ✗ | ✓ | ✓ | ✓ |
| Create snapshot ("Save version") | ✗ | ✗ | ✓ | ✓ | ✓ |
| Restore version | ✗ | ✗ | ✗ | ✓ | ✓ |
| Invite / change roles / remove members | ✗ | ✗ | ✗ | ✓ (cannot touch Owner or other Admins' roles above their own) | ✓ |
| Edit workspace name/description | ✗ | ✗ | ✗ | ✓ | ✓ |
| Delete workspace | ✗ | ✗ | ✗ | ✗ | ✓ |

**Rule for UI:** hide actions the user can never do; **disable with a tooltip** ("Only editors can do this") only where seeing the action helps understanding (e.g. the Save version button for a Commenter is hidden; the editor for a Viewer is read-only with a small "View only" badge).

Role display labels: Owner, Admin, Editor, Commenter, Viewer. Each has a one-line description shown in role pickers (use the descriptions from the spec).

---

## 6. App shell and navigation

### 6.1 AppShell (desktop ≥ 1024px)

```
┌──────────────┬───────────────────────────────────────────────┐
│ Sidebar 264  │ Top bar (48px)                                │
│              ├───────────────────────────────────────┬───────┤
│              │ Editor canvas (scrolls)               │ Panel │
│              │                                       │ (opt) │
└──────────────┴───────────────────────────────────────┴───────┘
```

### 6.2 Sidebar

#### 6.2.1 Container
- `<aside>` width **264px**, full viewport height, bg `--bg-subtle`, `border-right: 1px solid var(--border)`. `display:flex; flex-direction:column`. No shadow.
- Inner horizontal inset is **8px** on every zone, so row hover pills float 8px away from the edges (this is what makes it look refined; never let rows touch the sidebar edge).
- Content text is `--text-muted` by default and `--text` on hover/active. Never use pure black.
- **Collapse/expand:** width animates 264px → 0 over 200ms `cubic-bezier(0.2, 0, 0, 1)`; inner content has fixed width 264px and `overflow: hidden` on the aside, so content slides rather than reflows. The main area expands to fill. State persisted in `localStorage` key `conflux:sidebar`. Shortcut `⌘\`. Under `prefers-reduced-motion` there is no animation.
- Sidebar is not resizable in MVP.

Vertical structure (top to bottom, with heights):

```
┌──────────────────────────────┐
│ A. Header            52px    │  workspace switcher + collapse button
├──────────────────────────────┤
│ B. Primary nav       ~72px   │  Search, Home
│                              │
│ C. Pages section header 28px │  "Pages"  [+]
│    Pages list (scrolls)  1fr │
│                              │
├──────────────────────────────┤
│ D. Secondary nav     ~72px   │  Members, Settings
├──────────────────────────────┤
│ E. Footer (user)     56px    │
└──────────────────────────────┘
```

#### 6.2.2 Shared `SidebarRow` spec (used by B, C-items, D)
One component, used everywhere, so spacing is identical.
- Height **32px**, radius 6px, padding `0 8px`, gap 8px, `display:flex; align-items:center`. Rows are separated by **2px** (use `gap: 2px` on the list).
- Leading icon: lucide, **16px**, stroke width 1.75, color `--text-faint`. Label: 14/20, weight 400, single line, `text-overflow: ellipsis`.
- States:
  - *Default:* transparent bg, label `--text-muted`, icon `--text-faint`.
  - *Hover:* bg `--hover`, label `--text`, icon `--text-muted`. 100ms transition.
  - *Pressed:* bg `--pressed`.
  - *Active (current route):* bg `--bg-muted`, label `--text` weight 500, icon `--text`. Set `aria-current="page"`.
  - *Keyboard focus:* inset 2px `--accent` ring (see Section 3).
  - *Disabled:* opacity 0.5, no pointer events.
- Rows are real links (`next/link` → `<a>`) or buttons, never clickable `div`s.

#### 6.2.3 Zone A — Header (52px, padding 8px)
- **`WorkspaceSwitcher` trigger** (button): fills the width minus the collapse button, height **36px**, radius 8px, padding `0 8px`, gap 8px. Hover bg `--hover`. Open state bg `--hover` (stays highlighted while the menu is open).
  - `WorkspaceAvatar` 22px (radius 6px, one initial, color from the palette by workspace id hash, white text).
  - Workspace name 14/500 `--text`, truncated.
  - `chevrons-up-down` icon 14px `--text-faint`, right-aligned.
- **Collapse button** (icon button 28px, `panel-left-close` icon 16px) sits at the right end of the header, 4px gap from the trigger. Opacity 0 until the sidebar is hovered or focused (then 1, 120ms); always visible on touch devices. Tooltip "Close sidebar  ⌘\".
- **Switcher menu** (Dropdown spec from Section 3, width **280px**, align start, side-offset 4px):
  1. Overline "Workspaces".
  2. One item per workspace (height 36px): `WorkspaceAvatar` 20px, name 14px truncated, then on the right a 12px `--text-faint` role label (e.g. "Admin") and a `check` icon 16px `--accent` on the current workspace only. Max height 6 items (216px) before the list scrolls. Selecting navigates to `/w/:id`.
  3. Separator.
  4. "Create workspace" (`plus` icon) — opens a Dialog with the onboarding form (name + optional description).
  5. "Invite members" (`user-plus` icon, Admin+) — opens the Share dialog's invite section.
  6. "Workspace settings" (`settings` icon, Admin+) — navigates to settings.

#### 6.2.4 Zone B — Primary nav (padding `4px 8px 8px`)
Two `SidebarRow`s:
1. **Search** — icon `search`, label "Search", and a right-aligned `Kbd` chip (`⌘K`) in `--text-faint`. Opens the quick switcher. (Row does not get an active state.)
2. **Home** — icon `house`, label "Home". Active on `/w/:workspaceId` exactly.

#### 6.2.5 Zone C — Pages
**Section header** (height 28px, padding `0 8px`, margin-top 8px):
- Label "Pages": 12/500, `--text-faint`, sentence case (not uppercase). It is a button that collapses/expands the list; a 12px `chevron-right` icon appears to the left of the label on header hover and rotates 90° when expanded (120ms). Expanded state persisted in `localStorage` key `conflux:pagesExpanded`.
- At the right: a **"+" icon button** (24px, `plus` icon 14px), visible on section-header hover or keyboard focus, hidden for Viewer/Commenter. Tooltip "New page". This is the only "new page" control in the sidebar (no big button).

**List container:** `flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 8px`. Thin auto-hiding scrollbar (Section 3). A 12px top and bottom fade-mask (linear-gradient from `--bg-subtle` to transparent) appears only when the list overflows in that direction, so rows don't get hard-clipped.

**`PageListItem`** — extends `SidebarRow` (same 32px height, radius, states):
- Leading icon: `file-text` 16px (same icon for every page in MVP; no emoji picker).
- Title: 14/20, truncated. Empty title shows "Untitled" in `--text-faint`.
- **Trailing `⋯` button:** icon button 24px, radius 4px, `ellipsis` icon 14px, positioned at the right inside the row (right padding 4px). Hidden by default; shown on row hover, `:focus-within`, or while its menu is open. A 24px gradient fade (row-bg → transparent) sits left of the button so the title never collides with it. Hidden for Viewer/Commenter except "Copy link" (so for them the button shows only that item; if only one item, the button is omitted and Copy link is available via right-click).
- **Menu** (same for the `⋯` button and right-click via Radix ContextMenu): "Open in new tab" (`external-link`), "Copy link" (`link`), "Rename" (`pencil`, Editor+, shortcut `F2`), separator, "Delete" (`trash-2`, Editor+, destructive style).
- **Inline rename:** the row's label becomes an input (same font/size, bg `--bg`, 1px `--accent` border with 3px `--ring-soft` halo, radius 6px, text fully selected). Enter or blur saves (`PATCH`, optimistic); Esc cancels. Empty value saves as empty title ("Untitled").
- **Delete:** opens `ConfirmDialog` ("Delete "{title}"?", body "This page and its comments and version history will be permanently deleted.", danger button "Delete page"). If the deleted page is open, navigate to the next page in the list, or workspace home if none.
- **Ordering:** sorted by `created_at` **descending** (newest first) and **never re-sorted live**. (Sorting by `updated_at` would make rows jump while someone types a title. The Workspace home cards, in contrast, sort by `updated_at`.)
- **New page behavior:** clicking "+" (or any "New page" action) immediately creates the page via `POST` with an empty title, inserts the row at the top optimistically with an enter animation (height 0 → 32px and opacity 0 → 1 over 180ms), navigates to it, and focuses the title field. If the request fails, remove the row and show an error toast.
- No drag-and-drop reordering in MVP.

**States of the list:**
- *Loading:* 6 skeleton rows, 32px tall each, with a 16px square skeleton icon and a text bar (widths 60%, 80%, 50%, 70%, 90%, 65%).
- *Empty:* padding `8px 16px`, text "No pages yet" 13px `--text-muted`. For Editor+, under it a ghost `sm` button "Create a page" (`plus` icon).
- *Error:* "Couldn't load pages" 13px `--text-muted` and a link-styled "Retry" in `--accent`.

**Keyboard behavior in the list:** the list is a `role="list"` inside `<nav aria-label="Pages">`. Use roving tabindex: `Tab` enters the list on the active row, `↑`/`↓` move between rows, `Home`/`End` jump, `Enter` opens, `F2` renames, `Shift+F10` or the context-menu key opens the row menu.

#### 6.2.6 Zone D — Secondary nav (padding `8px`, `border-top: 1px solid var(--border)`)
Two `SidebarRow`s:
1. **Members** — icon `users`, label "Members". Active on the members settings route. Visible to all roles.
2. **Settings** — icon `settings`, label "Settings". Admin+ only. Active on `/w/:id/settings`.

#### 6.2.7 Zone E — Footer (height 56px, padding 8px, `border-top: 1px solid var(--border)`)
- **`UserMenu` trigger**: full-width button, height 40px, radius 8px, padding `0 8px`, gap 10px, hover bg `--hover`.
  - `UserAvatar` 28px (round).
  - Two-line text block: name 13/500 `--text` (top) and the user's role in this workspace, 12 `--text-faint` (bottom), both truncated.
  - `chevrons-up-down` 14px `--text-faint` at the right.
- **Menu** (opens upward, align start, width 248px):
  1. Non-interactive header block (padding 8px, gap 10px): `UserAvatar` 32px, name 14/500, email 13 `--text-muted` (truncated).
  2. Separator.
  3. "Profile" (`user`) — opens the Profile dialog.
  4. **Theme row** (not a menu item; custom row, height 36px, padding `0 8px`): label "Theme" 14px on the left, and on the right a segmented control of three 28px icon buttons (`sun`, `moon`, `monitor`) inside a pill (bg `--bg-muted`, radius 8px, padding 2px); the selected option has bg `--bg`, `--shadow-xs`, radius 6px. Selecting does not close the menu.
  5. "Keyboard shortcuts" (`keyboard`, shortcut chip `⌘/`).
  6. Separator.
  7. "Log out" (`log-out`).

#### 6.2.8 Tooltips and motion inside the sidebar
- Tooltips only on icon-only buttons (collapse, "+", `⋯`). Labelled rows have none.
- All hover/active color transitions 100ms ease-out. No hover transforms, no bounce.
- Keep content stable: no layout shift when hover buttons appear (they are absolutely positioned inside the row).

#### 6.2.9 Sidebar on mobile and tablet
- Rendered inside a Sheet (left side): width `min(85vw, 320px)`, same bg and content as desktop, overlay `--overlay`, slide-in 220ms. Closes on route change, overlay tap, or swipe-left.
- Row height 40px, font 15px, icons 18px (touch targets). The `⋯` and "+" buttons are always visible (no hover on touch), 32px. Bottom padding includes `env(safe-area-inset-bottom)`.
- The collapse button is replaced by a close "x" icon button.

#### 6.2.10 Component names (sidebar)
`Sidebar`, `SidebarHeader`, `WorkspaceSwitcher`, `WorkspaceAvatar`, `SidebarRow`, `SidebarSectionHeader`, `PageList`, `PageListItem`, `PageItemMenu`, `PageListSkeleton`, `SidebarFooter`, `UserMenu`, `ThemeSegmented`.

### 6.3 Top bar (editor page)
Height **48px**, bg `--bg`, padding `0 12px`, items vertically centered, gap 4px between controls (12px between groups). No bottom border at rest; a 1px `--border` bottom line fades in (120ms) once the canvas has scrolled more than 8px. Sticky at the top of the main area.

Left → right:
- **Sidebar toggle** (icon button 28px, `panel-left` icon) — only rendered when the sidebar is collapsed. Tooltip "Open sidebar  ⌘\".
- **Breadcrumb:** `Workspace name` / `Page title`, 14px. Workspace name is a ghost link (`--text-muted`, hover `--text` with `--hover` pill, padding 2px 6px, radius 6px). Separator is a `/` in `--text-faint` with 2px margins. Page title is `--text` weight 500, truncated at 280px max-width, "Untitled" in `--text-faint` when empty.
- *Spacer (flex 1)*
- **Presence avatars** (see 8.5), then 8px gap.
- **Sync status** (see 8.6), then 8px gap.
- **Comments button:** icon button 32px, `message-square` icon 18px. When there are open threads, a 16px-high badge (accent bg, white text 11/600, radius 8px, min-width 16px) overlaps the top-right of the icon. Active (panel open) state: bg `--bg-muted`.
- **History button:** icon button 32px, `history` icon 18px, same active state.
- **Share button:** Primary `md` button, label "Share", leading `users` icon 16px. 8px left margin.
- **`⋯` menu button:** icon button 32px, `ellipsis` icon 18px. Items: "Copy link" (`link`), "Save version" (`bookmark`, Editor+), separator, "Delete page" (`trash-2`, Editor+, destructive).

On non-editor pages (home, settings) the top bar shows only the sidebar toggle (when collapsed) and the breadcrumb (e.g. `Workspace name / Settings`).

### 6.4 Mobile (< 768px)
- Sidebar becomes a left **Sheet** drawer, opened with the hamburger icon.
- Presence avatars collapse to a "+N" chip.
- Comments and History panels open as bottom **Sheets** (full height, 85vh).
- Formatting toolbar becomes a horizontally scrollable strip pinned above the keyboard.
- Tablet (768–1023): sidebar is a drawer; panels are overlay drawers from the right.

### 6.5 Quick switcher (⌘K / Ctrl+K)
shadcn `Command` dialog. Input "Search pages…". Lists pages of the current workspace filtered client-side by title (fuzzy: simple case-insensitive includes). Also contains actions: "New page" (Editor+), "Go to members", "Toggle theme". Enter navigates. Esc closes.

---

## 7. Pages

### 7.1 `/login`
- Centered card (max 400px) on `--bg-subtle`. Logo wordmark "Conflux" at top, then heading "Welcome back".
- Fields: Email, Password (with show/hide). Primary button "Log in".
- Link: "New to Conflux? Create an account".
- Validation: zod (valid email, password required). Server errors (invalid credentials) shown inline under the form in `--danger`, not as a toast.
- On success: store session (cookie set by backend), redirect to `next` or `/`.

### 7.2 `/register`
- Fields: Name, Email, Password (min 8 chars, helper text under field). Button "Create account".
- Link to login. On success: auto-login, then redirect to `/onboarding` (or to `next`, e.g. an invitation URL).

### 7.3 `/onboarding`
- Single step: "Name your workspace" (input, required, placeholder "e.g. Acme Design"), optional description textarea collapsed behind "Add description". Button "Create workspace".
- On success: create a first page titled "Getting started" automatically (client calls `POST /workspaces/:id/pages`) and navigate to it. Do not seed any content via the API; the editor shows its empty state.

### 7.4 `/invite/[token]`
- Fetch `GET /invitations/:token`.
- States:
  - **Valid, logged in as matching email:** card "You've been invited to **{workspace}** as **{role}** by {inviter}". Button "Accept invitation" → `POST /invitations/:token/accept` → redirect to `/w/:id`.
  - **Valid, logged out:** same card, with buttons "Log in" and "Create account" (both carry `next=/invite/:token`). Pre-fill email on register if the invitation email is known.
  - **Logged in with a different email:** warning "This invitation was sent to {email}. You're signed in as {current}." Buttons: "Log out and switch account".
  - **Expired / revoked / already accepted / not found:** friendly error card with icon, explanation, and "Go to Conflux" button.

### 7.5 `/w/[workspaceId]` — Workspace home
- Heading: workspace name in Instrument Serif 40/1.1 (see Typography), description below in 14px `--text-muted` with 8px gap. Content column max-width 960px, centered, top padding 64px.
- Section "Pages": responsive card grid (1/2/3 columns). Each card: title, "Edited {relative time} · by {name}" is NOT available in the data model, so show only "Edited {relative time}". Card click opens the page.
- First card is "+ New page" (Editor+).
- Empty state: illustration-free, an icon, "No pages yet", subtext "Create your first page to start writing together.", primary button "New page" (hidden for Viewer/Commenter, who see "No pages yet" only).
- Loading: 6 skeleton cards.

### 7.6 `/w/[workspaceId]/p/[pageId]` — Editor page (the core screen)
See Sections 8–11 in detail.

### 7.7 `/w/[workspaceId]/settings` — General (Admin+ can edit, others read-only)
- Fields: Workspace name, Description. "Save changes" button enabled only when dirty.
- **Danger zone** (Owner only): "Delete workspace" button → confirm dialog requiring the user to type the workspace name. On success redirect to `/`.

### 7.8 `/w/[workspaceId]/settings/members` — Members & invitations
Tabs shown at the top of both settings pages: **General | Members**.
- **Invite form** (Admin+): email input + role select (Admin, Editor, Commenter, Viewer) + "Send invite" button. On success: toast "Invitation sent" and show the invite link with a Copy button (email delivery may not exist in MVP, so always show the copyable link `${origin}/invite/${token}`).
- **Members table**: avatar, name, email, role (select for Admin+, plain text otherwise), joined date, `⋯` (Remove member). Owner row has no menu and a fixed "Owner" badge. A user can't change their own role. Role change is optimistic with rollback on error. Remove opens a confirm dialog.
- **Pending invitations** list (see backend gaps): email, role, expires in, `Copy link`, `Revoke`.

### 7.9 `/w/[workspaceId]/settings/profile` — Profile
Linked from the sidebar and user menu. Keep the page in the same restrained settings style. Include a profile photo upload (PNG, JPEG, WebP, or AVIF, up to 5 MB) stored in Cloudflare R2, editable name, and read-only email. Save profile details with `PATCH /users/me`.

### 7.10 Global states
- `not-found.tsx`: "We couldn't find that page" + button back home.
- Forbidden (403 on a page/workspace): "You don't have access to this page" + button to the workspace home, + "Request access" is NOT in MVP.
- Generic error boundary: "Something went wrong" with Retry button.

---

## 8. Editor page — detailed behavior

### 8.1 Canvas layout
- Scroll container fills the area under the top bar. Content column 720px, centered, top padding 72px (40px on mobile), bottom padding 35vh so the last line can scroll up to mid-screen.
- **Title field:** a borderless, transparent, auto-growing `textarea` (placeholder "Untitled" in `--text-faint`) in **Instrument Serif** 48/1.1 weight 400 (see Typography table), 24px margin below. No outline on focus (the caret is the only focus indicator). `Enter` moves focus into the editor at document start. For read-only roles it renders as plain text.
- Title saves with `PATCH /pages/:pageId` **debounced 600ms** after typing stops (and flushed on blur/navigation). Show "Saving…" only through the global sync status. Also update the sidebar entry and document `<title>` optimistically.
- Below the title: the editor.

### 8.2 Formatting toolbar (slim, sticky under the top bar)
Height 40px, sticky directly under the top bar (top: 48px), bg `--bg`, content centered in a 720px column (not full-bleed), padding `0 4px`. A 1px `--border` bottom line fades in only once scrolled. Hidden entirely for Viewer and Commenter.

Button spec: icon buttons 28×28, radius 6px, icon 16px stroke 1.75, color `--text-muted`; hover bg `--hover` + `--text`; **active formatting** (e.g. bold on at the cursor) bg `--bg-muted` + `--text`; disabled opacity 0.4. Gap between buttons in a group: 2px. Group dividers: 1px × 16px `--border`, margin `0 6px`. The block-type dropdown is a ghost button, height 28px, padding `0 8px`, label 13/500 (e.g. "Heading 1", "Text") + `chevron-down` 14px, min-width 92px. Groups:
1. Undo, Redo
2. Block type dropdown: Paragraph, Heading 1, Heading 2, Heading 3
3. Bold, Italic, Underline, Strikethrough, Inline code
4. Bullet list, Numbered list, Task list
5. Blockquote, Code block, Horizontal rule
6. Link (opens a small popover with URL input; Enter applies; clear removes)
7. **Add comment** (speech-bubble+; enabled only when there is a non-empty selection; also available for Commenters, in which case it's the only visible toolbar control, shown as a floating button near the selection)

Every button has a tooltip with its name and shortcut.

**Editor typography and block styles (`.prose-conflux` in `globals.css`)** — implement exactly:
- Paragraph: Geist 16/1.65, margin 0, **block spacing 6px** between adjacent blocks (use `margin-top: 6px` on blocks, not margin-bottom), so text feels continuous like Notion rather than paragraph-spaced.
- Headings: margin-top 28px (H1), 24px (H2), 20px (H3), margin-bottom 4px; first heading in the doc has margin-top 0.
- Bullet / numbered lists: indent 24px, item spacing 2px, marker color `--text-muted`; nested levels use `disc → circle → square` and `1. → a. → i.`
- Task list: 18px checkbox, radius 4px, 1.5px `--text-faint` border; checked = `--accent` fill with white check; checked text gets `--text-faint` and strikethrough; 8px gap between checkbox and text.
- Blockquote: 3px left border in `color-mix(in srgb, var(--text) 18%, transparent)`, padding-left 16px, text color `--text-muted`, no italics.
- Inline code: Geist Mono 0.9em, bg `--bg-muted`, padding `1px 5px`, radius 4px, color `--text`. Code block: bg `--bg-subtle`, 1px `--border`, radius 8px, padding 14px 16px, Geist Mono 14/1.6, horizontal scroll, no wrapping.
- Horizontal rule: 1px `--border`, margin 20px 0.
- Links: color `--accent`, underline 1px with `text-underline-offset: 3px` and underline color at 40% opacity; hover underline at 100%. Clicking a link in edit mode opens a small hover card (URL, "Open", "Edit", "Remove"); in read-only mode it opens in a new tab (`rel="noopener noreferrer"`).
- Text selection color: `--accent` at 22% opacity. Caret color: `--text`.
- Placeholder text: `--text-faint`, shown with `pointer-events: none` via a `::before` pseudo-element.
- Active-block hint: when the caret is in an empty paragraph, show the placeholder (see 8.3); no left-hand drag handles or "+" gutter buttons in MVP.

### 8.3 Editor extensions (MVP set — no more)
Paragraph, Heading (1–3), Bold, Italic, Underline, Strike, Code, CodeBlock (no syntax highlighting in MVP), BulletList, OrderedList, TaskList/TaskItem, Blockquote, HorizontalRule, Link, Placeholder, Collaboration (Yjs fragment name `"default"`), CollaborationCursor, Dropcursor, Gapcursor, **CommentHighlight** (custom decoration extension, see Section 9), and **SlashCommand** (custom, below). **Disable Tiptap's own History extension** (Yjs undo manager handles undo/redo via the Collaboration extension). No images, tables, embeds or mentions in MVP.

**Placeholder:** empty first paragraph shows "Type '/' for commands, or just start writing…". Empty headings show "Heading".

**Keyboard shortcuts:** standard Tiptap/Docs set — `⌘B/I/U`, `⌘⇧X` strike, `⌘E` inline code, `⌘⌥1/2/3` headings, `⌘⇧7/8/9` lists, `⌘K` is reserved for the quick switcher so link is `⌘⇧K`... and markdown shortcuts (`# `, `- `, `1. `, `[] `, `> `, ``` ``` ```) enabled.

### 8.4 Slash menu
Typing `/` at the start of an empty block (or after a space) opens a floating menu at the caret, filtered as the user types. Menu spec: Dropdown container style from Section 3, width 280px, max-height 320px (scrolls), padding 4px, opens 6px below the caret (flips above if no room). Each item: height 48px, radius 6px, padding `0 8px`, gap 10px; leading 32×32 icon tile (bg `--bg-subtle`, 1px `--border`, radius 6px, lucide icon 16px `--text-muted`); two-line text: title 14/500 `--text`, description 12 `--text-faint`. Highlighted item bg `--hover` (keyboard and mouse share one highlight). Items (icon + title + one-line description): Text, Heading 1, Heading 2, Heading 3, Bullet list, Numbered list, Task list, Quote, Code block, Divider. Arrow keys / Enter select, Esc closes. Max 8 visible with scroll. "No results" row if none match. Hidden for read-only roles.

### 8.5 Presence (top bar) and live cursors
- **Awareness state** (set via `provider.awareness.setLocalStateField("user", …)`) exactly per the backend spec: `userId, name, avatarUrl, color, cursor, selection, onlineStatus`. The Collaboration cursor extension handles `cursor/selection`; also set `name` and `color`.
- **Remote cursors:** 2px caret in the user's color, with a small name label (12px, white text on the user's color, radius 4px) above the caret. The label shows on cursor movement and fades after 2.5s of inactivity; it reappears on hover. Remote selections render as 20%-opacity fill of the user's color.
- **Presence avatars:** stacked circles (24px, overlapping −6px) with initials or `avatarUrl`, ring in the user's color. Show up to 4, then a "+N" chip; clicking opens a popover listing all online users (name + "You" tag + color dot). Deduplicate by `userId` (same user in two tabs = one avatar). Tooltip shows the name. Clicking an avatar in the popover scrolls to that user's cursor (P1).
- A subtle toast is NOT shown on join/leave. Avatars appear/disappear with a 150ms fade.

### 8.6 Sync status indicator (top bar)
Small text + icon, muted, with tooltip. States driven by the `WebsocketProvider` events and doc updates:
- **Saved** (check icon): connected, no pending local changes.
- **Saving…** (spinner): connected and local updates not yet acknowledged (use a 400ms minimum display so it doesn't flicker).
- **Connecting…** (spinner): initial connect or reconnecting.
- **Offline — changes will sync when you're back** (cloud-off icon, `--warning`): disconnected. When offline, the editor stays editable (changes are buffered in the Yjs doc and in IndexedDB if enabled).
- **View only** (eye icon badge) for Viewer/Commenter instead of the above, still showing Offline if disconnected.

On reconnect, show nothing extra; the indicator returns to "Saved".

### 8.7 Permissions inside the editor
- Viewer/Commenter: `editor.setEditable(false)`; the cursor/selection still works for reading and for starting comments.
- Handle the WS `PERMISSION_CHANGED` event: refetch workspace/member data; apply the new role immediately (toggle editability and toolbar), show a toast "Your role was changed to {role}". If access is lost entirely, redirect to the workspace home with a toast.
- Handle WS auth failure/close code 4401/4403: show a full-page "You no longer have access" or redirect to login for 401.

### 8.8 Loading and error behavior for the editor
- Until the first Yjs sync completes (`provider.on("sync", true)`): show the title immediately (from `GET /pages/:id`) and a skeleton of 4 text lines under it. Don't render an editable editor before sync to avoid duplicate initial content.
- If the page is soft-deleted or missing: Not-found state.
- If the WS can't connect after 10s: show an inline banner "Having trouble connecting. Retrying…" above the editor (not blocking).

---

## 9. Comments

### 9.1 Anchoring (decision)
Comments are anchored with **Yjs relative positions**, not marks inside the document (so Commenters, who cannot edit the document, can still add comments, and anchors survive concurrent edits). `anchor` JSON shape stored with each root comment:

```ts
type CommentAnchor = {
  type: "range";
  from: unknown; // Y.relativePositionToJSON(...) of selection start
  to: unknown;   // Y.relativePositionToJSON(...) of selection end
  quotedText: string; // up to 200 chars, for display and as fallback
};
```
Use `absolutePositionToRelativePosition` / `relativePositionToAbsolutePosition` from `y-prosemirror` with the editor's `ySyncPluginKey` state. Replies (comments with `parent_id`) store `anchor: {}`.

If an anchor can no longer be resolved (text deleted), the thread is shown as **"Original text was deleted"** in the panel using `quotedText` with strikethrough, with no highlight in the editor.

### 9.2 Highlighting
`CommentHighlight` is a ProseMirror decoration plugin that takes the list of unresolved root comments, resolves positions, and applies an inline decoration with `--comment-highlight` background and a 2px bottom border. The active thread uses the stronger highlight. Clicking a highlight opens the Comments panel and focuses that thread. Resolved threads are not highlighted.

### 9.3 Creating a comment
1. User selects text → a small floating **"Comment"** button appears near the selection end (and the toolbar button enables).
2. Click → opens the Comments panel (if closed) with a new-thread composer at the top, showing the quoted text in a muted block and a textarea (autofocus). The selection stays visibly highlighted using a temporary decoration.
3. `Enter` to send (`Shift+Enter` newline), or "Comment" button; "Cancel" discards. Posts with `POST /pages/:pageId/comments`.

### 9.4 Comments panel (right side, 340px)
- Header: "Comments", tabs **Open | Resolved**, close button.
- Thread card: quoted text (2-line clamp, left accent border), then comments in order: avatar, name, relative time ("2h ago", tooltip with full date), content. Content rendered as plain text with auto-linked URLs and preserved line breaks (no markdown in MVP).
- Under the last comment: inline reply input "Reply…" (Commenter+). Expands on focus with Send/Cancel.
- Thread actions (`⋯` on the root and on each comment where permitted): Edit (own), Delete (own, or Admin+), Resolve thread / Reopen thread (Commenter+; "Resolve" also shown as a check icon button on hover of the card). Edited comments show "(edited)" when `updated_at > created_at`.
- Delete of a root comment with replies: confirm dialog "Delete this thread and its replies?".
- Thread ordering: by the anchor's position in the document (top to bottom) for Open; by `resolved_at` desc for Resolved. Fallback by `created_at` if position unresolved.
- Hovering a thread card scrolls/pulses the matching highlight; clicking a card scrolls the editor to it.
- Empty state: "No comments yet. Select some text and click Comment."
- Count badge on the top-bar Comments button = number of open threads.

### 9.5 Realtime
On receiving `COMMENT_CREATED / UPDATED / RESOLVED` WS events, invalidate the comments query (TanStack Query) rather than hand-merging. Show a brief 1s background flash on the newly arrived card. Mutations are optimistic for resolve/reopen; creation shows a pending state on the card.

If the optional app-level WS events are not wired up by the backend, fall back to polling `GET /pages/:id/comments` every 10s while the panel is open or any highlight is rendered (feature flag `NEXT_PUBLIC_COMMENTS_POLLING=true`).

---

## 10. Version history

### 10.1 History panel (right side, replaces the comments panel; only one panel at a time)
- Header: "Version history", close button, and a "Save version" button (Editor+).
- List of snapshots (newest first) from `GET /pages/:pageId/snapshots`, grouped under "Today / Yesterday / Earlier". Each row: label (or "Auto-saved version" when `label` is null), time ("3:42 PM"), author avatar + name. Selected row highlighted.
- "Save version" opens a small dialog: optional label input (placeholder "e.g. Before client review"), button "Save". Calls `POST /pages/:pageId/snapshots`.

### 10.2 Preview mode
Selecting a snapshot puts the editor area in **preview mode**:
- Fetch `GET /pages/:pageId/snapshots/:snapshotId`, decode `document_state` (base64 from API → `Uint8Array`) into a **temporary, detached `Y.Doc`**, and render it in a second **read-only** Tiptap instance (no provider, no cursors, no toolbar).
- A banner at the top of the canvas (accent-subtle background): "Viewing version from {date, time} · by {name}" with buttons **Restore this version** (Admin+) and **Back to current** (also `Esc`).
- Live editing, presence cursors and comments highlights are hidden while previewing. The live Yjs connection stays open in the background.

### 10.3 Restore
- Click "Restore this version" → confirm dialog: "Restore this version? The current document will be saved as a new version first, so you can undo this." Buttons: Cancel, Restore.
- Calls `POST /pages/:pageId/snapshots/:snapshotId/restore`. While pending, the button shows a spinner and the dialog stays open.
- On success: close preview, toast "Version restored", refetch snapshots, and **reload the Yjs provider** (destroy and recreate the `Y.Doc` and `WebsocketProvider`, since the server replaced the document state). All collaborators must receive the restore: handle the server closing the room/connection with a "restored" signal by recreating the provider and showing a toast "This page was restored to an earlier version."
- Errors show a toast with a Retry option.

---

## 11. Share dialog

Opened from the top bar Share button. It reflects **workspace-level** access (the data model has no page-level permissions), and must say so in plain text: "Everyone in {workspace} can access this page based on their role."
- Section 1: **Copy link** button (copies the current page URL).
- Section 2 (Admin+): "Invite people" — email + role select + Send invite (same logic as 7.8, result shows copyable invite link).
- Section 3: "People with access" — list of members (avatar, name, role), max height with scroll, link "Manage members" → members settings. Non-Admins see the list read-only.

---

## 12. Component inventory

Build these as reusable components under `apps/web/components/`. Props are indicative; keep them typed.

**Layout:** `AppShell`, `TopBar`, `Breadcrumb`, `QuickSwitcher`, `SidePanel` (container for comments/history; Sheet on mobile), `SettingsTabs`. Sidebar components are listed in Section 6.2.10.

**Editor:** `PageTitleInput`, `CollaborativeEditor` (owns Y.Doc + provider lifecycle), `EditorToolbar`, `ToolbarButton`, `BlockTypeSelect`, `LinkPopover`, `SlashMenu`, `CommentSelectionButton`, `ReadOnlyEditor` (for version preview), `EditorSkeleton`, `ConnectionBanner`.

**Collaboration UI:** `PresenceAvatars`, `PresencePopover`, `SyncStatus`, `UserAvatar` (initials fallback + color ring), `RemoteCursorLabel` (extension render fn).

**Comments:** `CommentsPanel`, `CommentThreadCard`, `CommentItem`, `CommentComposer`, `CommentReplyInput`, `CommentTabs`.

**History:** `HistoryPanel`, `SnapshotListItem`, `SaveVersionDialog`, `VersionPreviewBanner`, `RestoreConfirmDialog`.

**Workspace/members:** `CreateWorkspaceForm`, `InviteForm`, `MembersTable`, `RoleSelect`, `PendingInvitationsList`, `ShareDialog`, `ConfirmDialog` (generic, supports "type name to confirm"), `InviteLinkField` (read-only input + copy).

**Feedback:** `EmptyState`, `ErrorState`, `PageSkeleton`, `Toaster` wrapper, `Kbd` (shortcut chip).

**Feature hooks (`hooks/`):** `useAuth`, `useWorkspaces`, `useWorkspace(id)`, `usePages(workspaceId)`, `usePage(id)`, `useMembers`, `useInvitations`, `useComments(pageId)`, `useSnapshots(pageId)`, `usePermissions(role)`, `useCollabProvider(pageId)` (returns `{ doc, provider, status, awarenessUsers }`), `useDebouncedCallback`, `useHotkeys`.

---

## 13. Data layer

- `lib/api.ts`: thin `fetch` wrapper, base `/api/v1`, `credentials: "include"`, JSON in/out, throws a typed `ApiError { status, code, message }`. Global 401 handler.
- Query keys: `["me"]`, `["workspaces"]`, `["workspace", id]`, `["pages", workspaceId]`, `["page", id]`, `["members", workspaceId]`, `["invitations", workspaceId]`, `["comments", pageId]`, `["snapshots", pageId]`.
- Mutations invalidate the relevant keys; optimistic updates for: page rename, role change, resolve/reopen comment, delete page.
- Defaults: `staleTime` 30s; refetch on window focus on (this keeps page titles roughly fresh between collaborators).
- WebSocket URL from env `NEXT_PUBLIC_COLLAB_URL`. Provider: `new WebsocketProvider(COLLAB_URL, pageId, ydoc, { params: { token } })`. Token from the auth endpoint (see gaps).
- Environment variables: `NEXT_PUBLIC_API_URL` (default `/api/v1`), `NEXT_PUBLIC_COLLAB_URL`, `NEXT_PUBLIC_COMMENTS_POLLING`.

---

## 14. Folder structure (`apps/web`)

```
apps/web/
├── app/                       # routes per Section 4
├── components/
│   ├── ui/                    # shadcn primitives
│   ├── layout/ editor/ collab/ comments/ history/ workspace/ feedback/
├── hooks/
├── lib/
│   ├── api.ts  permissions.ts  colors.ts  format.ts  yjs.ts
│   └── editor/
│       ├── extensions.ts      # builds the extension list
│       ├── slash-command.tsx
│       └── comment-highlight.ts
├── stores/ ui-store.ts        # zustand
├── styles/ globals.css        # tokens + prose styles for the editor
└── middleware.ts
```

---

## 15. Quality bar

### 15.1 States every screen must have
Loading (skeleton, never a blank screen), empty, error with Retry, and forbidden. Buttons showing async work show a spinner and are disabled. Destructive actions always use `ConfirmDialog`.

### 15.2 Accessibility
Full keyboard navigation, visible focus rings, `aria-label` on icon buttons, dialogs trap focus, color is never the only state indicator (cursor labels include names; sync status includes text), contrast ≥ WCAG AA in both themes. Toolbar uses `role="toolbar"`. Slash menu uses `role="listbox"`.

### 15.3 Performance
Dynamic-import the editor and its extensions (`next/dynamic`, `ssr: false`) so non-editor pages stay light. Memoize presence rendering; throttle awareness-driven re-renders to 100ms. Virtualization is not needed in MVP.

### 15.4 Keyboard shortcuts summary
`⌘K` quick switcher · `⌘\` toggle sidebar · `⌘⌥M` add comment on selection · `Esc` exit version preview / close panel · `⌘/` open shortcut cheat sheet dialog (simple static list) · standard text formatting shortcuts.

### 15.5 Acceptance checklist (frontend)
- [ ] Register, login, logout, and `next` redirects work; unauthenticated users never see app routes.
- [ ] Onboarding creates a workspace and first page.
- [ ] Sidebar lists/creates/renames/deletes pages; reflects changes in real time on refocus.
- [ ] Two browsers on one page: edits converge, remote cursors with names and colors are visible, presence avatars update, same-user-two-tabs shows once.
- [ ] Killing the network: indicator shows Offline, typing continues, reconnect syncs with no data loss.
- [ ] Viewer cannot edit (no toolbar, read-only); Commenter can comment but not edit.
- [ ] Comment create/reply/edit/delete/resolve/reopen work; highlights move correctly as the document changes; orphaned anchors handled.
- [ ] Save version, browse versions, preview read-only, restore with confirmation; all collaborators land on the restored state.
- [ ] Invitation flows: create, copy link, accept (logged in/out), expired states, revoke.
- [ ] Members page: role changes and removals obey the permission matrix.
- [ ] Light and dark themes both polished; mobile layout usable.

---

## 16. Backend gaps & assumptions (implement the frontend against these)

The backend spec is missing a few things the UI needs. The frontend assumes these will be added, and should code against them (use a typed mock in `lib/api.ts` behind a flag until they exist):

1. **WebSocket auth token:** `GET /api/v1/auth/ws-token` → `{ token: string }` (short-lived JWT, ~5 min). The collaboration server is on a different origin, so the session cookie won't be sent. Frontend passes it as a `token` query param and refetches a fresh one before each (re)connect.
2. **`myRole` on workspace endpoints:** `GET /workspaces` and `GET /workspaces/:id` include `myRole`.
3. **Pending invitations list:** `GET /workspaces/:workspaceId/invitations` → invitations where `accepted_at` is null and not expired.
4. **Invitation details payload** (`GET /invitations/:token`) includes: `workspace { id, name }`, `invitedBy { name }`, `email`, `role`, `status` ("valid" | "expired" | "accepted" | "revoked").
5. **Snapshot detail** returns `document_state` as a **base64 string** plus `created_by { id, name, avatar_url }` and `label`. The snapshot list returns the same metadata **without** `document_state`.
6. **Page list/detail** includes `updated_at`; page detail includes `created_by { name }`.
7. **Comment payloads** include `author { id, name, avatar_url }`; the comment list returns root comments with their replies nested under `replies`.
8. **Restore signal:** after a restore, the collab server closes active connections for that room with close code `4000` and reason `"restored"` so clients recreate the provider.
9. **Page titles are not part of the Yjs document**, so title changes by one user show up for others after a refetch (window focus, or on `PERMISSION_CHANGED`/page-level events if added later). Accepted limitation for MVP.
10. **Pages are a flat list** (no nesting) because the schema has no `parent_id`.
11. **Email delivery for invitations may not exist**, so the UI always exposes the invite link for manual sharing.

---

## 17. Explicitly out of scope for MVP

Page nesting/folders, templates, images/files/tables/embeds, @mentions, notifications and inbox, trash/restore deleted pages, page-level permissions or public share links, full-text search across document bodies, export (PDF/Markdown), version diff highlighting, suggestion mode, emoji reactions, workspace avatars/logos, 2FA/OAuth, i18n, and real-time page-title sync.
