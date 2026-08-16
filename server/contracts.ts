import { z } from 'zod';

export const entityTypes = [
  'groups', 'members', 'expenses', 'contributions', 'daily_meals',
  'daily_menus', 'categories', 'vendors', 'group_settings', 'audit_logs',
] as const;

export const pushSchema = z.object({
  householdId: z.string().min(1),
  operations: z.array(z.object({
    operationId: z.string().min(1),
    entityType: z.enum(entityTypes),
    entityId: z.string().min(1),
    baseVersion: z.number().int().nonnegative(),
    deleted: z.boolean().default(false),
    payload: z.record(z.string(), z.unknown()),
  })).max(250),
});

export const pullSchema = z.object({
  householdId: z.string().min(1),
  cursor: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
