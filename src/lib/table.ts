import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Table } from "dynamodb-toolbox/table";
import { Entity } from "dynamodb-toolbox/entity";
import { item, string, boolean as dtBool, list } from "dynamodb-toolbox/schema";
import type { AwsCredentials } from "./auth";
import { config } from "./config";

export type Category =
  | "food"
  | "drink"
  | "music"
  | "movies"
  | "series"
  | "books"
  | "games"
  | "places"
  | "colors"
  | "gifts"
  | "hobbies"
  | "dislikes";

export const CATEGORIES: Category[] = [
  "food", "drink", "music", "movies", "series", "books",
  "games", "places", "colors", "gifts", "hobbies", "dislikes",
];

export function createDynamoTable(creds: AwsCredentials) {
  const client = new DynamoDBClient({
    region: config.awsRegion,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
  const documentClient = DynamoDBDocumentClient.from(client);

  const AppTable = new Table({
    name: config.dynamoTableName,
    partitionKey: { name: "PK", type: "string" },
    sortKey: { name: "SK", type: "string" },
    indexes: {
      GSI1: {
        type: "global",
        partitionKey: { name: "GSI1PK", type: "string" },
        sortKey: { name: "GSI1SK", type: "string" },
      },
    },
    documentClient,
  });

  const FriendEntity = new Entity({
    name: "Friend",
    table: AppTable,
    schema: item({
      // .key() marks these as computeKey inputs — required in key mode
      userId: string().key(),
      friendId: string().key(),
      name: string().required("atLeastOnce"),
      nickname: string().optional(),
      birthday: string().optional(),
      avatarColor: string().default("#6366f1"),
      createdAt: string().required("atLeastOnce"),
      updatedAt: string().required("always"),
    }),
    computeKey: ({ userId, friendId }: { userId: string; friendId: string }) => ({
      PK: `USER#${userId}`,
      SK: `FRIEND#${friendId}`,
    }),
  });

  const PreferenceEntity = new Entity({
    name: "Preference",
    table: AppTable,
    schema: item({
      userId: string().key(),
      friendId: string().key(),
      category: string().key(),
      items: list(string()).default([]),
      updatedAt: string().required("always"),
    }),
    computeKey: ({ userId, friendId, category }: { userId: string; friendId: string; category: string }) => ({
      PK: `USER#${userId}`,
      SK: `FRIEND#${friendId}#PREF#${category}`,
    }),
  });

  const ImportantDateEntity = new Entity({
    name: "ImportantDate",
    table: AppTable,
    schema: item({
      userId: string().key(),
      friendId: string().key(),
      dateId: string().key(),
      title: string().required("atLeastOnce"),
      date: string().required("atLeastOnce"),
      recurring: dtBool().default(false),
      createdAt: string().required("atLeastOnce"),
    }),
    computeKey: ({ userId, friendId, dateId }: { userId: string; friendId: string; dateId: string }) => ({
      PK: `USER#${userId}`,
      SK: `FRIEND#${friendId}#DATE#${dateId}`,
    }),
  });

  const NoteEntity = new Entity({
    name: "Note",
    table: AppTable,
    schema: item({
      userId: string().key(),
      friendId: string().key(),
      noteId: string().key(),
      content: string().required("atLeastOnce"),
      createdAt: string().required("atLeastOnce"),
      updatedAt: string().required("always"),
    }),
    computeKey: ({ userId, friendId, noteId }: { userId: string; friendId: string; noteId: string }) => ({
      PK: `USER#${userId}`,
      SK: `FRIEND#${friendId}#NOTE#${noteId}`,
    }),
  });

  const ReminderEntity = new Entity({
    name: "Reminder",
    table: AppTable,
    schema: item({
      userId: string().key(),
      friendId: string().key(),
      reminderId: string().key(),
      title: string().required("atLeastOnce"),
      description: string().optional(),
      remindAt: string().required("atLeastOnce"),
      completed: dtBool().default(false),
      createdAt: string().required("atLeastOnce"),
      GSI1PK: string().required("atLeastOnce"),
      GSI1SK: string().required("atLeastOnce"),
    }),
    computeKey: ({ userId, friendId, reminderId }: { userId: string; friendId: string; reminderId: string }) => ({
      PK: `USER#${userId}`,
      SK: `FRIEND#${friendId}#REMINDER#${reminderId}`,
    }),
  });

  return { AppTable, FriendEntity, PreferenceEntity, ImportantDateEntity, NoteEntity, ReminderEntity };
}

export type DynamoContext = ReturnType<typeof createDynamoTable>;
