export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  myRole: string;
};

export type Page = {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at: string;
  auto_snapshots_enabled?: boolean;
};

export type PageSummary = Omit<Page, "content">;

export function canEdit(role?: string) {
  return ["OWNER", "ADMIN", "EDITOR"].includes(role ?? "");
}
