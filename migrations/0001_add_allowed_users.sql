-- Migration number: 0001 	 2026-02-10T00:43:43.112Z
CREATE TABLE allowed_users (
  email TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 最初に自分のメールアドレスだけは許可リストに入れておく（締め出し防止）
INSERT INTO allowed_users (email) VALUES ('y.ryota1014@gmail.com');