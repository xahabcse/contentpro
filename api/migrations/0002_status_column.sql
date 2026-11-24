-- Migration number: 0002 	 2026-11-24
-- Owner, 24 Nov 2026 (protfolio docs/plan/data-cleanup.md): as in learning, the portfolio and NewsPortal, an account
-- the admin deletes keeps its row with status 404 (Active 1, Inactive -1, Deleted 404). It cannot sign in, its
-- sessions end, and only the admin's Cleanup restores it or deletes it for good with its profile images.
ALTER TABLE users ADD COLUMN status INTEGER NOT NULL DEFAULT 1;
