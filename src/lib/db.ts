import { QueryCommand } from "dynamodb-toolbox/table/actions/query";
import { PutItemCommand } from "dynamodb-toolbox/entity/actions/put";
import { UpdateItemCommand } from "dynamodb-toolbox/entity/actions/update";
import { DeleteItemCommand } from "dynamodb-toolbox/entity/actions/delete";
import type { DynamoContext, Category } from "./table";

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  return crypto.randomUUID();
}

// ── Friends ──────────────────────────────────────────────────────────────────

export interface Friend {
  userId: string;
  friendId: string;
  name: string;
  nickname?: string;
  birthday?: string;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

export async function listFriends(ctx: DynamoContext, userId: string): Promise<Friend[]> {
  const res = await ctx.AppTable.build(QueryCommand)
    .query({ partition: `USER#${userId}`, range: { beginsWith: "FRIEND#" } })
    .options({ filters: { entity: "Friend" } })
    .send();
  return (res.Items ?? []) as unknown as Friend[];
}

export async function putFriend(
  ctx: DynamoContext,
  userId: string,
  data: { name: string; nickname?: string; birthday?: string; avatarColor?: string; friendId?: string }
): Promise<Friend> {
  const now = nowIso();
  const friendId = data.friendId ?? randomId();
  const friend: Friend = {
    userId,
    friendId,
    name: data.name,
    nickname: data.nickname,
    birthday: data.birthday,
    avatarColor: data.avatarColor ?? "#6366f1",
    createdAt: now,
    updatedAt: now,
  };
  await ctx.FriendEntity.build(PutItemCommand).item(friend).send();
  return friend;
}

export async function updateFriend(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  data: Partial<{ name: string; nickname: string; birthday: string; avatarColor: string }>
): Promise<void> {
  await ctx.FriendEntity.build(UpdateItemCommand)
    .item({ userId, friendId, ...data, updatedAt: nowIso() })
    .send();
}

export async function deleteFriend(ctx: DynamoContext, userId: string, friendId: string): Promise<void> {
  await ctx.FriendEntity.build(DeleteItemCommand).key({ userId, friendId }).send();
}

// ── Preferences ───────────────────────────────────────────────────────────────

export interface Preference {
  userId: string;
  friendId: string;
  category: Category;
  items: string[];
  updatedAt: string;
}

export async function listPreferences(
  ctx: DynamoContext,
  userId: string,
  friendId: string
): Promise<Preference[]> {
  const res = await ctx.AppTable.build(QueryCommand)
    .query({ partition: `USER#${userId}`, range: { beginsWith: `FRIEND#${friendId}#PREF#` } })
    .options({ filters: { entity: "Preference" } })
    .send();
  return (res.Items ?? []) as unknown as Preference[];
}

export async function upsertPreference(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  category: Category,
  items: string[]
): Promise<void> {
  await ctx.PreferenceEntity.build(PutItemCommand)
    .item({ userId, friendId, category, items, updatedAt: nowIso() })
    .send();
}

// ── Important Dates ───────────────────────────────────────────────────────────

export interface ImportantDate {
  userId: string;
  friendId: string;
  dateId: string;
  title: string;
  date: string;
  recurring: boolean;
  createdAt: string;
}

export async function listDates(
  ctx: DynamoContext,
  userId: string,
  friendId: string
): Promise<ImportantDate[]> {
  const res = await ctx.AppTable.build(QueryCommand)
    .query({ partition: `USER#${userId}`, range: { beginsWith: `FRIEND#${friendId}#DATE#` } })
    .options({ filters: { entity: "ImportantDate" } })
    .send();
  return (res.Items ?? []) as unknown as ImportantDate[];
}

export async function putDate(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  data: { title: string; date: string; recurring?: boolean; dateId?: string }
): Promise<ImportantDate> {
  const now = nowIso();
  const dateId = data.dateId ?? randomId();
  const record: ImportantDate = {
    userId,
    friendId,
    dateId,
    title: data.title,
    date: data.date,
    recurring: data.recurring ?? false,
    createdAt: now,
  };
  await ctx.ImportantDateEntity.build(PutItemCommand).item(record).send();
  return record;
}

export async function deleteDate(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  dateId: string
): Promise<void> {
  await ctx.ImportantDateEntity.build(DeleteItemCommand).key({ userId, friendId, dateId }).send();
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export interface Note {
  userId: string;
  friendId: string;
  noteId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export async function listNotes(
  ctx: DynamoContext,
  userId: string,
  friendId: string
): Promise<Note[]> {
  const res = await ctx.AppTable.build(QueryCommand)
    .query({ partition: `USER#${userId}`, range: { beginsWith: `FRIEND#${friendId}#NOTE#` } })
    .options({ filters: { entity: "Note" } })
    .send();
  return (res.Items ?? []) as unknown as Note[];
}

export async function putNote(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  data: { content: string; noteId?: string }
): Promise<Note> {
  const now = nowIso();
  const noteId = data.noteId ?? randomId();
  const note: Note = {
    userId,
    friendId,
    noteId,
    content: data.content,
    createdAt: now,
    updatedAt: now,
  };
  await ctx.NoteEntity.build(PutItemCommand).item(note).send();
  return note;
}

export async function updateNote(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  noteId: string,
  content: string
): Promise<void> {
  await ctx.NoteEntity.build(UpdateItemCommand)
    .item({ userId, friendId, noteId, content, updatedAt: nowIso() })
    .send();
}

export async function deleteNote(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  noteId: string
): Promise<void> {
  await ctx.NoteEntity.build(DeleteItemCommand).key({ userId, friendId, noteId }).send();
}

// ── Reminders ─────────────────────────────────────────────────────────────────

export interface Reminder {
  userId: string;
  friendId: string;
  reminderId: string;
  title: string;
  description?: string;
  remindAt: string;
  completed: boolean;
  createdAt: string;
  GSI1PK: string;
  GSI1SK: string;
}

export async function listReminders(
  ctx: DynamoContext,
  userId: string,
  friendId: string
): Promise<Reminder[]> {
  const res = await ctx.AppTable.build(QueryCommand)
    .query({ partition: `USER#${userId}`, range: { beginsWith: `FRIEND#${friendId}#REMINDER#` } })
    .options({ filters: { entity: "Reminder" } })
    .send();
  return (res.Items ?? []) as unknown as Reminder[];
}

export async function putReminder(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  data: { title: string; description?: string; remindAt: string; reminderId?: string }
): Promise<Reminder> {
  const now = nowIso();
  const reminderId = data.reminderId ?? randomId();
  const reminder: Reminder = {
    userId,
    friendId,
    reminderId,
    title: data.title,
    description: data.description,
    remindAt: data.remindAt,
    completed: false,
    createdAt: now,
    GSI1PK: `USER#${userId}#REMINDERS`,
    GSI1SK: data.remindAt,
  };
  await ctx.ReminderEntity.build(PutItemCommand).item(reminder).send();
  return reminder;
}

export async function toggleReminder(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  reminderId: string,
  completed: boolean
): Promise<void> {
  await ctx.ReminderEntity.build(UpdateItemCommand)
    .item({ userId, friendId, reminderId, completed })
    .send();
}

export async function deleteReminder(
  ctx: DynamoContext,
  userId: string,
  friendId: string,
  reminderId: string
): Promise<void> {
  await ctx.ReminderEntity.build(DeleteItemCommand).key({ userId, friendId, reminderId }).send();
}
