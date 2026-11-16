# Conflux — Project Specification

This document describes Conflux's product behavior, data model, and technical
architecture. For a quick project overview and local setup, see the root
[README](README.md).

## 1. Application Goal

Conflux is a real-time collaborative workspace where users create workspaces,
invite team members, and collaboratively create and edit rich-text documents.
Collaborators edit shared pages, see live cursors and presence, and synchronize
document changes with Yjs over WebSockets. The product includes workspace and
member management, role-based permissions, threaded comments, document
persistence, version history, and document restoration.

---

## 2. Database Schema

**Database:** PostgreSQL  
**ORM:** Prisma

### User
- id: uuid (primary key)
- name: string
- email: string (unique)
- password_hash: string
- avatar_url: string (nullable)
- created_at: timestamp
- updated_at: timestamp

### Workspace
- id: uuid (primary key)
- name: string
- description: string (nullable)
- owner_id: uuid (FK → User)
- created_at: timestamp
- updated_at: timestamp

### WorkspaceMember
- id: uuid (primary key)
- workspace_id: uuid (FK → Workspace)
- user_id: uuid (FK → User)
- role: "OWNER" | "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER"
- joined_at: timestamp

**Constraints:**
- Unique(workspace_id, user_id)
- Owner has full workspace control.
- Admin can manage members and workspace content.
- Editor can edit documents.
- Commenter can read and comment.
- Viewer can only read.

### Invitation
- id: uuid (primary key)
- workspace_id: uuid (FK → Workspace)
- invited_by: uuid (FK → User)
- email: string
- token: string (unique)
- role: "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER"
- expires_at: timestamp
- accepted_at: timestamp (nullable)
- created_at: timestamp

### Page
- id: uuid (primary key)
- workspace_id: uuid (FK → Workspace)
- title: string
- created_by: uuid (FK → User)
- created_at: timestamp
- updated_at: timestamp
- deleted_at: timestamp (nullable)

### PageUpdate
Stores incremental Yjs document updates for persistence and recovery.

- id: uuid (primary key)
- page_id: uuid (FK → Page)
- update: bytes (Yjs binary update)
- created_at: timestamp

### PageSnapshot
Stores historical document states.

- id: uuid (primary key)
- page_id: uuid (FK → Page)
- created_by: uuid (FK → User)
- document_state: bytes (Yjs encoded state)
- label: string (nullable)
- created_at: timestamp

### Comment
- id: uuid (primary key)
- page_id: uuid (FK → Page)
- author_id: uuid (FK → User)
- parent_id: uuid (nullable, FK → Comment)
- content: text
- anchor: json (document position/selection reference)
- resolved_at: timestamp (nullable)
- created_at: timestamp
- updated_at: timestamp

**Constraints:**
- parent_id allows threaded replies.
- anchor stores the location of the comment in the document.

### Important Database Notes
- Store Yjs updates in binary form.
- Persist document updates incrementally instead of rewriting the entire document on every keystroke.
- Create snapshots periodically. Restoring a snapshot replaces the current document state.
- Use database transactions when restoring document versions.
- Index workspace_id, page_id, user_id, and created_at for frequently queried records.
- Deduplicate or compact Yjs updates periodically to control storage growth.

---

## 3. HTTP API Routes

Base path: `/api/v1`

### Authentication
- POST `/auth/register` - Register a new user.
- POST `/auth/login` - Authenticate user.
- GET `/auth/me` - Get current authenticated user.

### User
- GET `/users/me` - Get current user profile.
- PATCH `/users/me` - Update profile.
- GET `/users/:userId` - Get user details.

### Workspace
- POST `/workspaces` - Create workspace.
- GET `/workspaces` - Get user's workspaces.
- GET `/workspaces/:workspaceId` - Get workspace details.
- PATCH `/workspaces/:workspaceId` - Update workspace.
- DELETE `/workspaces/:workspaceId` - Delete workspace.

### Workspace Members
- GET `/workspaces/:workspaceId/members` - List workspace members.
- PATCH `/workspaces/:workspaceId/members/:userId` - Update member role.
- DELETE `/workspaces/:workspaceId/members/:userId` - Remove member.

### Invitations
- POST `/workspaces/:workspaceId/invitations` - Invite a member.
- GET `/invitations/:token` - Get invitation details.
- POST `/invitations/:token/accept` - Accept invitation.
- DELETE `/workspaces/:workspaceId/invitations/:invitationId` - Revoke invitation.

### Pages
- POST `/workspaces/:workspaceId/pages` - Create page.
- GET `/workspaces/:workspaceId/pages` - List workspace pages.
- GET `/pages/:pageId` - Get page details.
- PATCH `/pages/:pageId` - Update page metadata/title.
- DELETE `/pages/:pageId` - Delete page.

### Comments
- POST `/pages/:pageId/comments` - Create comment.
- GET `/pages/:pageId/comments` - Get page comments.
- GET `/comments/:commentId` - Get comment details.
- PATCH `/comments/:commentId` - Edit comment.
- DELETE `/comments/:commentId` - Delete comment.
- PATCH `/comments/:commentId/resolve` - Resolve comment.
- PATCH `/comments/:commentId/reopen` - Reopen comment.

### Version History
- POST `/pages/:pageId/snapshots` - Create document snapshot.
- GET `/pages/:pageId/snapshots` - List snapshots.
- GET `/pages/:pageId/snapshots/:snapshotId` - Get snapshot details.
- POST `/pages/:pageId/snapshots/:snapshotId/restore` - Restore snapshot.

---

## 4. WebSocket Service

**Technology:** Node.js + WebSockets + Yjs + y-websocket

### Connection

- `wss://collaboration.example.com/:pageId`

Each document gets an isolated collaboration room identified by its page ID.

On connection:
1. Authenticate the user.
2. Validate workspace membership.
3. Check page-level access permissions.
4. Join the corresponding Yjs document room.
5. Synchronize document state.
6. Broadcast presence information.

### Core Yjs Synchronization Protocol

These protocol messages are handled by Yjs/y-websocket and define the document
collaboration protocol.

- `SYNC_STEP_1` - Client requests document synchronization using its state vector.
- `SYNC_STEP_2` - Server responds with missing document state.
- `UPDATE` - Exchange incremental document updates.
- `AWARENESS_UPDATE` - Broadcast presence and cursor changes.
- `AWARENESS_QUERY` - Request current awareness states.

### Presence Events

Awareness state should contain:

- userId
- name
- avatarUrl
- color
- cursor
- selection
- onlineStatus

### Application-Level WebSocket Events

These are optional custom events for application features beyond Yjs synchronization.

**Client → Server**
- `COMMENT_CREATE` - Create a comment.
- `COMMENT_UPDATE` - Edit a comment.
- `COMMENT_RESOLVE` - Resolve a comment.
- `PING` - Check connection health.

**Server → Client**
- `USER_JOINED` - A collaborator joined the page.
- `USER_LEFT` - A collaborator left the page.
- `COMMENT_CREATED` - New comment notification.
- `COMMENT_UPDATED` - Comment updated.
- `COMMENT_RESOLVED` - Comment resolved.
- `PONG` - Connection health response.
- `PERMISSION_CHANGED` - User permissions changed.
- `ERROR` - Connection or operation error.

### Server Responsibilities

- Maintain active Yjs document instances.
- Synchronize updates between connected clients.
- Persist Yjs updates to PostgreSQL.
- Restore document state when a room is initialized.
- Manage awareness and online presence.
- Validate permissions before accepting document modifications.
- Handle disconnections and reconnections.

---

## 5. Technical Architecture

| Component | Technology |
|---|---|
| Frontend | Next.js + TypeScript |
| Editor | ProseMirror |
| Collaboration Engine | Yjs |
| Real-Time Communication | WebSockets + Yjs sync protocol |
| Backend APIs | Next.js Route Handlers |
| Collaboration Server | Bun (`apps/ws`) |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache and cross-process relay | Redis (optional) |
| Authentication | Session/JWT-based authentication |

### Repository structure

```text
conflux/
├── apps/
│   ├── web/                  # Next.js application
│   └── ws/                   # Bun WebSocket collaboration service
│
├── packages/
│   ├── database/             # Prisma schema and client
│   ├── seed/                  # Demo workspace fixtures
│   └── config-eslint/        # Shared lint configuration
│
└── package.json              # Bun workspace and task scripts
```

---

## 6. Core Acceptance Criteria

- Users can register, log in and create workspaces.
- Workspace owners can invite members and manage permissions.
- Users can create and manage multiple documents.
- Multiple users can edit the same document simultaneously.
- Concurrent edits converge and preserve changes.
- Live cursors and collaborator presence work correctly.
- Document updates survive server restarts.
- Disconnected clients can reconnect and synchronize changes.
- Comments and threaded replies work.
- Previous document versions can be restored.
- Restricted documents are accessible only to authorized users.

