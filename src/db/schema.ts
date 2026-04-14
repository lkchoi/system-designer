export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS designs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS design_state (
    design_id TEXT PRIMARY KEY,
    nodes TEXT NOT NULL DEFAULT '[]',
    edges TEXT NOT NULL DEFAULT '[]',
    viewport TEXT NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
    FOREIGN KEY (design_id) REFERENCES designs(id)
  );

  CREATE TABLE IF NOT EXISTS flow_paths (
    id TEXT PRIMARY KEY,
    design_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    steps TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY (design_id) REFERENCES designs(id)
  );
`;
