import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const workspaces = sqliteTable("workspaces", {
  userId: text("user_id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export const aiReviews = sqliteTable("ai_reviews", {
  key: text("key").primaryKey(),
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  requestId: text("request_id").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default('pending'),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const aiConnections = sqliteTable("ai_connections", {
  userId: text("user_id").primaryKey(),
  lastSeenAt: text("last_seen_at").notNull(),
});

// Kept separate from editable workspace JSON so ordinary saves cannot erase connections.
export const calendarConnections = sqliteTable('calendar_connections', {
  userId: text('user_id').primaryKey(),
  encryptedToken: text('encrypted_token').notNull(),
  connectedAt: text('connected_at').notNull(),
  lockUntil: integer('lock_until').notNull().default(0),
});
export const calendarStates = sqliteTable('calendar_states', {
  userId: text('user_id').primaryKey(),
  nonce: text('nonce').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const calendarSnapshots = sqliteTable('calendar_snapshots', {
  key: text('key').primaryKey(),
  userId: text('user_id').notNull(),
  week: text('week').notNull(),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});
