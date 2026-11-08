import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// 优化历史记录
export const promptHistory = pgTable("prompt_history", {
  id: serial("id").primaryKey(),
  originalPrompt: text("original_prompt").notNull(),
  optimizedPrompt: text("optimized_prompt").notNull(),
  scenario: text("scenario").notNull().default("general"),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  scoreBefore: integer("score_before").notNull().default(0),
  scoreAfter: integer("score_after").notNull().default(0),
  analysis: jsonb("analysis").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 收藏的提示词
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  category: text("category").notNull().default("通用"),
  note: text("note").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 模板库（内置 + 用户自定义）
export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("通用"),
  description: text("description").notNull().default(""),
  templateText: text("template_text").notNull(),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
