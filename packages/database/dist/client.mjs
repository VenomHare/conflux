// src/client.ts
import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";
import postgresStatic from "@prisma/orm-postgres/static";

// generated/contract.json
var contract_default = {
  schemaVersion: "1",
  targetFamily: "sql",
  target: "postgres",
  profileHash: "3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2",
  roots: {
    Comment: {
      model: "Comment",
      namespace: "public"
    },
    Invitation: {
      model: "Invitation",
      namespace: "public"
    },
    Page: {
      model: "Page",
      namespace: "public"
    },
    PageSnapshot: {
      model: "PageSnapshot",
      namespace: "public"
    },
    PageUpdate: {
      model: "PageUpdate",
      namespace: "public"
    },
    User: {
      model: "User",
      namespace: "public"
    },
    Workspace: {
      model: "Workspace",
      namespace: "public"
    },
    WorkspaceMember: {
      model: "WorkspaceMember",
      namespace: "public"
    }
  },
  domain: {
    namespaces: {
      public: {
        enum: {
          InvitationRole: {
            codecId: "pg/text@1",
            members: [
              {
                name: "ADMIN",
                value: "ADMIN"
              },
              {
                name: "EDITOR",
                value: "EDITOR"
              },
              {
                name: "COMMENTER",
                value: "COMMENTER"
              },
              {
                name: "VIEWER",
                value: "VIEWER"
              }
            ]
          },
          WorkspaceRole: {
            codecId: "pg/text@1",
            members: [
              {
                name: "OWNER",
                value: "OWNER"
              },
              {
                name: "ADMIN",
                value: "ADMIN"
              },
              {
                name: "EDITOR",
                value: "EDITOR"
              },
              {
                name: "COMMENTER",
                value: "COMMENTER"
              },
              {
                name: "VIEWER",
                value: "VIEWER"
              }
            ]
          }
        },
        models: {
          Comment: {
            fields: {
              anchor: {
                nullable: false,
                type: {
                  codecId: "pg/json@1",
                  kind: "scalar"
                }
              },
              author_id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              content: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              created_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              page_id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              parent_id: {
                nullable: true,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              resolved_at: {
                nullable: true,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              updated_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              }
            },
            relations: {
              author: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "author_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "User",
                  namespace: "public"
                }
              },
              page: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "page_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "Page",
                  namespace: "public"
                }
              },
              parent: {
                cardinality: "N:1",
                nullable: true,
                on: {
                  localFields: [
                    "parent_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "Comment",
                  namespace: "public"
                }
              },
              replies: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "parent_id"
                  ]
                },
                to: {
                  model: "Comment",
                  namespace: "public"
                }
              }
            },
            storage: {
              fields: {
                anchor: {
                  column: "anchor"
                },
                author_id: {
                  column: "author_id"
                },
                content: {
                  column: "content"
                },
                created_at: {
                  column: "created_at"
                },
                id: {
                  column: "id"
                },
                page_id: {
                  column: "page_id"
                },
                parent_id: {
                  column: "parent_id"
                },
                resolved_at: {
                  column: "resolved_at"
                },
                updated_at: {
                  column: "updated_at"
                }
              },
              namespaceId: "public",
              table: "Comment"
            }
          },
          Invitation: {
            fields: {
              accepted_at: {
                nullable: true,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              created_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              email: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              expires_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              invited_by: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              role: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                },
                valueSet: {
                  entityKind: "enum",
                  entityName: "InvitationRole",
                  namespaceId: "public",
                  plane: "domain"
                }
              },
              token: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              workspace_id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              }
            },
            relations: {
              inviter: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "invited_by"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "User",
                  namespace: "public"
                }
              },
              workspace: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "workspace_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "Workspace",
                  namespace: "public"
                }
              }
            },
            storage: {
              fields: {
                accepted_at: {
                  column: "accepted_at"
                },
                created_at: {
                  column: "created_at"
                },
                email: {
                  column: "email"
                },
                expires_at: {
                  column: "expires_at"
                },
                id: {
                  column: "id"
                },
                invited_by: {
                  column: "invited_by"
                },
                role: {
                  column: "role"
                },
                token: {
                  column: "token"
                },
                workspace_id: {
                  column: "workspace_id"
                }
              },
              namespaceId: "public",
              table: "Invitation"
            }
          },
          Page: {
            fields: {
              created_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              created_by: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              deleted_at: {
                nullable: true,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              title: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              updated_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              workspace_id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              }
            },
            relations: {
              comments: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "page_id"
                  ]
                },
                to: {
                  model: "Comment",
                  namespace: "public"
                }
              },
              creator: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "created_by"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "User",
                  namespace: "public"
                }
              },
              snapshots: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "page_id"
                  ]
                },
                to: {
                  model: "PageSnapshot",
                  namespace: "public"
                }
              },
              updates: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "page_id"
                  ]
                },
                to: {
                  model: "PageUpdate",
                  namespace: "public"
                }
              },
              workspace: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "workspace_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "Workspace",
                  namespace: "public"
                }
              }
            },
            storage: {
              fields: {
                created_at: {
                  column: "created_at"
                },
                created_by: {
                  column: "created_by"
                },
                deleted_at: {
                  column: "deleted_at"
                },
                id: {
                  column: "id"
                },
                title: {
                  column: "title"
                },
                updated_at: {
                  column: "updated_at"
                },
                workspace_id: {
                  column: "workspace_id"
                }
              },
              namespaceId: "public",
              table: "Page"
            }
          },
          PageSnapshot: {
            fields: {
              created_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              created_by: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              document_state: {
                nullable: false,
                type: {
                  codecId: "pg/bytea@1",
                  kind: "scalar"
                }
              },
              id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              label: {
                nullable: true,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              page_id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              }
            },
            relations: {
              creator: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "created_by"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "User",
                  namespace: "public"
                }
              },
              page: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "page_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "Page",
                  namespace: "public"
                }
              }
            },
            storage: {
              fields: {
                created_at: {
                  column: "created_at"
                },
                created_by: {
                  column: "created_by"
                },
                document_state: {
                  column: "document_state"
                },
                id: {
                  column: "id"
                },
                label: {
                  column: "label"
                },
                page_id: {
                  column: "page_id"
                }
              },
              namespaceId: "public",
              table: "PageSnapshot"
            }
          },
          PageUpdate: {
            fields: {
              created_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              page_id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              update: {
                nullable: false,
                type: {
                  codecId: "pg/bytea@1",
                  kind: "scalar"
                }
              }
            },
            relations: {
              page: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "page_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "Page",
                  namespace: "public"
                }
              }
            },
            storage: {
              fields: {
                created_at: {
                  column: "created_at"
                },
                id: {
                  column: "id"
                },
                page_id: {
                  column: "page_id"
                },
                update: {
                  column: "update"
                }
              },
              namespaceId: "public",
              table: "PageUpdate"
            }
          },
          User: {
            fields: {
              avatar_url: {
                nullable: true,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              created_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              email: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              name: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              password_hash: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              updated_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              }
            },
            relations: {
              comments: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "author_id"
                  ]
                },
                to: {
                  model: "Comment",
                  namespace: "public"
                }
              },
              created_pages: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "created_by"
                  ]
                },
                to: {
                  model: "Page",
                  namespace: "public"
                }
              },
              created_snapshots: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "created_by"
                  ]
                },
                to: {
                  model: "PageSnapshot",
                  namespace: "public"
                }
              },
              invitations: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "invited_by"
                  ]
                },
                to: {
                  model: "Invitation",
                  namespace: "public"
                }
              },
              memberships: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "user_id"
                  ]
                },
                to: {
                  model: "WorkspaceMember",
                  namespace: "public"
                }
              },
              owned_workspaces: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "owner_id"
                  ]
                },
                to: {
                  model: "Workspace",
                  namespace: "public"
                }
              }
            },
            storage: {
              fields: {
                avatar_url: {
                  column: "avatar_url"
                },
                created_at: {
                  column: "created_at"
                },
                email: {
                  column: "email"
                },
                id: {
                  column: "id"
                },
                name: {
                  column: "name"
                },
                password_hash: {
                  column: "password_hash"
                },
                updated_at: {
                  column: "updated_at"
                }
              },
              namespaceId: "public",
              table: "User"
            }
          },
          Workspace: {
            fields: {
              created_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              description: {
                nullable: true,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              name: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                }
              },
              owner_id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              updated_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              }
            },
            relations: {
              invitations: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "workspace_id"
                  ]
                },
                to: {
                  model: "Invitation",
                  namespace: "public"
                }
              },
              members: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "workspace_id"
                  ]
                },
                to: {
                  model: "WorkspaceMember",
                  namespace: "public"
                }
              },
              owner: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "owner_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "User",
                  namespace: "public"
                }
              },
              pages: {
                cardinality: "1:N",
                on: {
                  localFields: [
                    "id"
                  ],
                  targetFields: [
                    "workspace_id"
                  ]
                },
                to: {
                  model: "Page",
                  namespace: "public"
                }
              }
            },
            storage: {
              fields: {
                created_at: {
                  column: "created_at"
                },
                description: {
                  column: "description"
                },
                id: {
                  column: "id"
                },
                name: {
                  column: "name"
                },
                owner_id: {
                  column: "owner_id"
                },
                updated_at: {
                  column: "updated_at"
                }
              },
              namespaceId: "public",
              table: "Workspace"
            }
          },
          WorkspaceMember: {
            fields: {
              id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              joined_at: {
                nullable: false,
                type: {
                  codecId: "pg/timestamptz-string@1",
                  kind: "scalar"
                }
              },
              role: {
                nullable: false,
                type: {
                  codecId: "pg/text@1",
                  kind: "scalar"
                },
                valueSet: {
                  entityKind: "enum",
                  entityName: "WorkspaceRole",
                  namespaceId: "public",
                  plane: "domain"
                }
              },
              user_id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              },
              workspace_id: {
                nullable: false,
                type: {
                  codecId: "pg/uuid@1",
                  kind: "scalar"
                }
              }
            },
            relations: {
              user: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "user_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "User",
                  namespace: "public"
                }
              },
              workspace: {
                cardinality: "N:1",
                nullable: false,
                on: {
                  localFields: [
                    "workspace_id"
                  ],
                  targetFields: [
                    "id"
                  ]
                },
                to: {
                  model: "Workspace",
                  namespace: "public"
                }
              }
            },
            storage: {
              fields: {
                id: {
                  column: "id"
                },
                joined_at: {
                  column: "joined_at"
                },
                role: {
                  column: "role"
                },
                user_id: {
                  column: "user_id"
                },
                workspace_id: {
                  column: "workspace_id"
                }
              },
              namespaceId: "public",
              table: "WorkspaceMember"
            }
          }
        }
      }
    }
  },
  storage: {
    namespaces: {
      public: {
        entries: {
          table: {
            Comment: {
              columns: {
                anchor: {
                  codecId: "pg/json@1",
                  dataType: "pg/json",
                  nullable: false
                },
                author_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                content: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false
                },
                created_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                },
                id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                page_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                parent_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: true
                },
                resolved_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  nullable: true
                },
                updated_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                }
              },
              foreignKeys: [
                {
                  index: {
                    name: "Comment_page_id_idx_37049384"
                  },
                  onDelete: "cascade",
                  source: {
                    columns: [
                      "page_id"
                    ],
                    namespaceId: "public",
                    tableName: "Comment"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "Page"
                  }
                },
                {
                  index: {
                    name: "Comment_author_id_idx_f3862461"
                  },
                  onDelete: "restrict",
                  source: {
                    columns: [
                      "author_id"
                    ],
                    namespaceId: "public",
                    tableName: "Comment"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "User"
                  }
                },
                {
                  index: {
                    name: "Comment_parent_id_idx_ab33b399"
                  },
                  onDelete: "cascade",
                  source: {
                    columns: [
                      "parent_id"
                    ],
                    namespaceId: "public",
                    tableName: "Comment"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "Comment"
                  }
                }
              ],
              indexes: [
                {
                  columns: [
                    "author_id"
                  ],
                  name: "Comment_author_id_idx_f3862461",
                  prefix: "Comment_author_id_idx",
                  unique: false
                },
                {
                  columns: [
                    "created_at"
                  ],
                  name: "Comment_created_at_idx_225d8c0f",
                  prefix: "Comment_created_at_idx",
                  unique: false
                },
                {
                  columns: [
                    "page_id"
                  ],
                  name: "Comment_page_id_idx_37049384",
                  prefix: "Comment_page_id_idx",
                  unique: false
                },
                {
                  columns: [
                    "parent_id"
                  ],
                  name: "Comment_parent_id_idx_ab33b399",
                  prefix: "Comment_parent_id_idx",
                  unique: false
                }
              ],
              primaryKey: {
                columns: [
                  "id"
                ]
              },
              uniques: []
            },
            Invitation: {
              checks: [
                {
                  expression: `"role" IN ('ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER')`,
                  name: "Invitation_role_check_61d34f53",
                  prefix: "Invitation_role_check"
                }
              ],
              columns: {
                accepted_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  nullable: true
                },
                created_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                },
                email: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false
                },
                expires_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  nullable: false
                },
                id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                invited_by: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                role: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false,
                  valueSet: {
                    entityKind: "valueSet",
                    entityName: "InvitationRole",
                    namespaceId: "public",
                    plane: "storage"
                  }
                },
                token: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false
                },
                workspace_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                }
              },
              foreignKeys: [
                {
                  index: {
                    name: "Invitation_workspace_id_idx_90a9f461"
                  },
                  onDelete: "cascade",
                  source: {
                    columns: [
                      "workspace_id"
                    ],
                    namespaceId: "public",
                    tableName: "Invitation"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "Workspace"
                  }
                },
                {
                  index: {
                    name: "Invitation_invited_by_idx_2ee9cf82"
                  },
                  onDelete: "restrict",
                  source: {
                    columns: [
                      "invited_by"
                    ],
                    namespaceId: "public",
                    tableName: "Invitation"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "User"
                  }
                }
              ],
              indexes: [
                {
                  columns: [
                    "created_at"
                  ],
                  name: "Invitation_created_at_idx_225d8c0f",
                  prefix: "Invitation_created_at_idx",
                  unique: false
                },
                {
                  columns: [
                    "invited_by"
                  ],
                  name: "Invitation_invited_by_idx_2ee9cf82",
                  prefix: "Invitation_invited_by_idx",
                  unique: false
                },
                {
                  columns: [
                    "workspace_id"
                  ],
                  name: "Invitation_workspace_id_idx_90a9f461",
                  prefix: "Invitation_workspace_id_idx",
                  unique: false
                }
              ],
              primaryKey: {
                columns: [
                  "id"
                ]
              },
              uniques: [
                {
                  columns: [
                    "token"
                  ]
                }
              ]
            },
            Page: {
              columns: {
                created_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                },
                created_by: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                deleted_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  nullable: true
                },
                id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                title: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false
                },
                updated_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                },
                workspace_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                }
              },
              foreignKeys: [
                {
                  index: {
                    name: "Page_workspace_id_idx_90a9f461"
                  },
                  onDelete: "cascade",
                  source: {
                    columns: [
                      "workspace_id"
                    ],
                    namespaceId: "public",
                    tableName: "Page"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "Workspace"
                  }
                },
                {
                  index: {
                    name: "Page_created_by_idx_e13bb8bf"
                  },
                  onDelete: "restrict",
                  source: {
                    columns: [
                      "created_by"
                    ],
                    namespaceId: "public",
                    tableName: "Page"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "User"
                  }
                }
              ],
              indexes: [
                {
                  columns: [
                    "created_at"
                  ],
                  name: "Page_created_at_idx_225d8c0f",
                  prefix: "Page_created_at_idx",
                  unique: false
                },
                {
                  columns: [
                    "created_by"
                  ],
                  name: "Page_created_by_idx_e13bb8bf",
                  prefix: "Page_created_by_idx",
                  unique: false
                },
                {
                  columns: [
                    "workspace_id"
                  ],
                  name: "Page_workspace_id_idx_90a9f461",
                  prefix: "Page_workspace_id_idx",
                  unique: false
                }
              ],
              primaryKey: {
                columns: [
                  "id"
                ]
              },
              uniques: []
            },
            PageSnapshot: {
              columns: {
                created_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                },
                created_by: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                document_state: {
                  codecId: "pg/bytea@1",
                  dataType: "pg/bytea",
                  nullable: false
                },
                id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                label: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: true
                },
                page_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                }
              },
              foreignKeys: [
                {
                  index: {
                    name: "PageSnapshot_page_id_idx_37049384"
                  },
                  onDelete: "cascade",
                  source: {
                    columns: [
                      "page_id"
                    ],
                    namespaceId: "public",
                    tableName: "PageSnapshot"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "Page"
                  }
                },
                {
                  index: {
                    name: "PageSnapshot_created_by_idx_e13bb8bf"
                  },
                  onDelete: "restrict",
                  source: {
                    columns: [
                      "created_by"
                    ],
                    namespaceId: "public",
                    tableName: "PageSnapshot"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "User"
                  }
                }
              ],
              indexes: [
                {
                  columns: [
                    "created_at"
                  ],
                  name: "PageSnapshot_created_at_idx_225d8c0f",
                  prefix: "PageSnapshot_created_at_idx",
                  unique: false
                },
                {
                  columns: [
                    "created_by"
                  ],
                  name: "PageSnapshot_created_by_idx_e13bb8bf",
                  prefix: "PageSnapshot_created_by_idx",
                  unique: false
                },
                {
                  columns: [
                    "page_id"
                  ],
                  name: "PageSnapshot_page_id_idx_37049384",
                  prefix: "PageSnapshot_page_id_idx",
                  unique: false
                }
              ],
              primaryKey: {
                columns: [
                  "id"
                ]
              },
              uniques: []
            },
            PageUpdate: {
              columns: {
                created_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                },
                id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                page_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                update: {
                  codecId: "pg/bytea@1",
                  dataType: "pg/bytea",
                  nullable: false
                }
              },
              foreignKeys: [
                {
                  index: {
                    name: "PageUpdate_page_id_idx_37049384"
                  },
                  onDelete: "cascade",
                  source: {
                    columns: [
                      "page_id"
                    ],
                    namespaceId: "public",
                    tableName: "PageUpdate"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "Page"
                  }
                }
              ],
              indexes: [
                {
                  columns: [
                    "created_at"
                  ],
                  name: "PageUpdate_created_at_idx_225d8c0f",
                  prefix: "PageUpdate_created_at_idx",
                  unique: false
                },
                {
                  columns: [
                    "page_id"
                  ],
                  name: "PageUpdate_page_id_idx_37049384",
                  prefix: "PageUpdate_page_id_idx",
                  unique: false
                }
              ],
              primaryKey: {
                columns: [
                  "id"
                ]
              },
              uniques: []
            },
            User: {
              columns: {
                avatar_url: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: true
                },
                created_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                },
                email: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false
                },
                id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                name: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false
                },
                password_hash: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false
                },
                updated_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                }
              },
              foreignKeys: [],
              indexes: [],
              primaryKey: {
                columns: [
                  "id"
                ]
              },
              uniques: [
                {
                  columns: [
                    "email"
                  ]
                }
              ]
            },
            Workspace: {
              columns: {
                created_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                },
                description: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: true
                },
                id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                name: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false
                },
                owner_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                updated_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                }
              },
              foreignKeys: [
                {
                  index: {
                    name: "Workspace_owner_id_idx_ade9f347"
                  },
                  onDelete: "restrict",
                  source: {
                    columns: [
                      "owner_id"
                    ],
                    namespaceId: "public",
                    tableName: "Workspace"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "User"
                  }
                }
              ],
              indexes: [
                {
                  columns: [
                    "owner_id"
                  ],
                  name: "Workspace_owner_id_idx_ade9f347",
                  prefix: "Workspace_owner_id_idx",
                  unique: false
                }
              ],
              primaryKey: {
                columns: [
                  "id"
                ]
              },
              uniques: []
            },
            WorkspaceMember: {
              checks: [
                {
                  expression: `"role" IN ('OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER')`,
                  name: "WorkspaceMember_role_check_48281d41",
                  prefix: "WorkspaceMember_role_check"
                }
              ],
              columns: {
                id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                joined_at: {
                  codecId: "pg/timestamptz-string@1",
                  dataType: "pg/timestamptz",
                  default: {
                    expression: "now()",
                    kind: "function"
                  },
                  nullable: false
                },
                role: {
                  codecId: "pg/text@1",
                  dataType: "pg/text",
                  nullable: false,
                  valueSet: {
                    entityKind: "valueSet",
                    entityName: "WorkspaceRole",
                    namespaceId: "public",
                    plane: "storage"
                  }
                },
                user_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                },
                workspace_id: {
                  codecId: "pg/uuid@1",
                  dataType: "pg/uuid",
                  nullable: false
                }
              },
              foreignKeys: [
                {
                  index: {
                    name: "WorkspaceMember_workspace_id_idx_90a9f461"
                  },
                  onDelete: "cascade",
                  source: {
                    columns: [
                      "workspace_id"
                    ],
                    namespaceId: "public",
                    tableName: "WorkspaceMember"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "Workspace"
                  }
                },
                {
                  index: {
                    name: "WorkspaceMember_user_id_idx_6c952402"
                  },
                  onDelete: "cascade",
                  source: {
                    columns: [
                      "user_id"
                    ],
                    namespaceId: "public",
                    tableName: "WorkspaceMember"
                  },
                  target: {
                    columns: [
                      "id"
                    ],
                    namespaceId: "public",
                    tableName: "User"
                  }
                }
              ],
              indexes: [
                {
                  columns: [
                    "user_id"
                  ],
                  name: "WorkspaceMember_user_id_idx_6c952402",
                  prefix: "WorkspaceMember_user_id_idx",
                  unique: false
                },
                {
                  columns: [
                    "workspace_id"
                  ],
                  name: "WorkspaceMember_workspace_id_idx_90a9f461",
                  prefix: "WorkspaceMember_workspace_id_idx",
                  unique: false
                }
              ],
              primaryKey: {
                columns: [
                  "id"
                ]
              },
              uniques: [
                {
                  columns: [
                    "workspace_id",
                    "user_id"
                  ]
                }
              ]
            }
          },
          valueSet: {
            InvitationRole: {
              kind: "valueSet",
              values: [
                "ADMIN",
                "EDITOR",
                "COMMENTER",
                "VIEWER"
              ]
            },
            WorkspaceRole: {
              kind: "valueSet",
              values: [
                "OWNER",
                "ADMIN",
                "EDITOR",
                "COMMENTER",
                "VIEWER"
              ]
            }
          }
        },
        id: "public",
        kind: "postgres-schema"
      }
    },
    storageHash: "f73635e120bda3085690250807a4a8566b03195f63d941212e485dba6e8359b4"
  },
  execution: {
    executionHash: "5533a1044afe43121c1969c79ccebdd13b3850b4672af3aba2e649fe3929bb64",
    mutations: {
      defaults: [
        {
          onCreate: {
            id: "uuidv4",
            kind: "generator"
          },
          ref: {
            entry: "Comment",
            field: "id",
            namespace: "public"
          }
        },
        {
          onCreate: {
            id: "uuidv4",
            kind: "generator"
          },
          ref: {
            entry: "Invitation",
            field: "id",
            namespace: "public"
          }
        },
        {
          onCreate: {
            id: "uuidv4",
            kind: "generator"
          },
          ref: {
            entry: "Page",
            field: "id",
            namespace: "public"
          }
        },
        {
          onCreate: {
            id: "uuidv4",
            kind: "generator"
          },
          ref: {
            entry: "PageSnapshot",
            field: "id",
            namespace: "public"
          }
        },
        {
          onCreate: {
            id: "uuidv4",
            kind: "generator"
          },
          ref: {
            entry: "PageUpdate",
            field: "id",
            namespace: "public"
          }
        },
        {
          onCreate: {
            id: "uuidv4",
            kind: "generator"
          },
          ref: {
            entry: "User",
            field: "id",
            namespace: "public"
          }
        },
        {
          onCreate: {
            id: "uuidv4",
            kind: "generator"
          },
          ref: {
            entry: "Workspace",
            field: "id",
            namespace: "public"
          }
        },
        {
          onCreate: {
            id: "uuidv4",
            kind: "generator"
          },
          ref: {
            entry: "WorkspaceMember",
            field: "id",
            namespace: "public"
          }
        }
      ]
    }
  },
  capabilities: {
    postgres: {
      distinctOn: true,
      forKeyShare: true,
      forNoKeyUpdate: true,
      jsonAgg: true,
      lateral: true,
      limit: true,
      orderBy: true,
      returning: true
    },
    sql: {
      checkConstraint: true,
      defaultInInsert: true,
      enums: true,
      forShare: true,
      forUpdate: true,
      insertOnConflictSkip: true,
      insertOnConflictWithoutTarget: true,
      lateral: true,
      lockNowait: true,
      lockOf: true,
      lockSkipLocked: true,
      returning: true,
      scalarList: true
    }
  },
  extensions: {},
  meta: {},
  _generated: {
    warning: "\u26A0\uFE0F  GENERATED FILE - DO NOT EDIT",
    message: 'This file is automatically generated by "prisma contract emit".',
    regenerate: "To regenerate, run: prisma contract emit"
  }
};

// src/client.ts
var staticContext = postgresStatic({
  contractJson: contract_default
});
var db = postgres({
  contract: staticContext.contract,
  url: process.env.DATABASE_URL
});
var connectionPromise = null;
async function getDb() {
  if (!connectionPromise) {
    connectionPromise = db.connect();
  }
  await connectionPromise;
  return db;
}
export {
  db,
  getDb
};
