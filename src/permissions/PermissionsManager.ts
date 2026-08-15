import { MemberRepository } from '@/database/repositories/MemberRepository';
import { GroupRole, MemberStatus } from '@/types';

// Permission keys matching the backend groupPermissions system
export type PermissionKey =
  | 'expense.create'
  | 'expense.update'
  | 'expense.delete'
  | 'contribution.create'
  | 'contribution.update'
  | 'contribution.delete'
  | 'meal.create'
  | 'meal.update'
  | 'meal.delete'
  | 'menu.create'
  | 'menu.update'
  | 'menu.delete'
  | 'menu.publish'
  | 'member.manage'
  | 'member.freeze'
  | 'category.manage'
  | 'vendor.manage'
  | 'join_request.manage'
  | 'leadership.manage'
  | 'group.settings'
  | 'audit.view';

// Default permissions by role (mirrors backend groupPermissions.ts)
const ROLE_DEFAULTS: Record<GroupRole, PermissionKey[]> = {
  group_admin: [
    'expense.create', 'expense.update', 'expense.delete',
    'contribution.create', 'contribution.update', 'contribution.delete',
    'meal.create', 'meal.update', 'meal.delete',
    'menu.create', 'menu.update', 'menu.delete', 'menu.publish',
    'member.manage', 'member.freeze',
    'category.manage', 'vendor.manage',
    'join_request.manage', 'leadership.manage',
    'group.settings', 'audit.view',
  ],
  creator: [
    'expense.create', 'expense.update', 'expense.delete',
    'contribution.create', 'contribution.update', 'contribution.delete',
    'meal.create', 'meal.update', 'meal.delete',
    'menu.create', 'menu.update', 'menu.delete', 'menu.publish',
    'member.manage', 'member.freeze',
    'category.manage', 'vendor.manage',
    'join_request.manage', 'leadership.manage',
    'group.settings', 'audit.view',
  ],
  manager: [
    'expense.create', 'expense.update', 'expense.delete',
    'contribution.create', 'contribution.update', 'contribution.delete',
    'meal.create', 'meal.update', 'meal.delete',
    'menu.create', 'menu.update', 'menu.delete', 'menu.publish',
    'member.manage',
    'category.manage', 'vendor.manage',
    'group.settings',
  ],
  treasurer: [
    'contribution.create', 'contribution.update', 'contribution.delete',
    'expense.create', 'expense.update',
    'meal.create', 'meal.update',
  ],
  sub_manager: [
    'expense.create', 'expense.update',
    'contribution.create', 'contribution.update',
    'meal.create', 'meal.update',
    'menu.create', 'menu.update', 'menu.publish',
  ],
  assistant_manager: [
    'expense.create',
    'contribution.create', 'contribution.update',
    'meal.create', 'meal.update',
    'menu.create', 'menu.update',
  ],
  member: [
    'expense.create',
    'contribution.create',
    'meal.create', 'meal.update',
  ],
};

export interface PermissionContext {
  groupId: string;
  userId: string;
  role: GroupRole;
  status: MemberStatus;
  permissions: Record<string, boolean>;
}

/**
 * PermissionsManager — evaluates permissions locally for UI behavior.
 * Backend authorization is ALWAYS final — this is only for UI display/hide.
 */
class PermissionsManagerClass {
  hasPermission(ctx: PermissionContext, key: PermissionKey): boolean {
    // Frozen members: no protected writes
    if (ctx.status === 'frozen') {
      // Frozen members can still read (view), but cannot create/update/delete
      if (key.includes('.create') || key.includes('.update') || key.includes('.delete') ||
          key.includes('.manage') || key.includes('.publish') || key.includes('.freeze')) {
        return false;
      }
    }

    // Check explicit permission overrides first
    if (key in ctx.permissions) {
      return ctx.permissions[key];
    }

    // Fall back to role defaults
    const defaults = ROLE_DEFAULTS[ctx.role] || [];
    return defaults.includes(key);
  }

  canCreate(ctx: PermissionContext, entity: string): boolean {
    return this.hasPermission(ctx, `${entity}.create` as PermissionKey);
  }

  canUpdate(ctx: PermissionContext, entity: string): boolean {
    return this.hasPermission(ctx, `${entity}.update` as PermissionKey);
  }

  canDelete(ctx: PermissionContext, entity: string): boolean {
    return this.hasPermission(ctx, `${entity}.delete` as PermissionKey);
  }

  canManage(ctx: PermissionContext, entity: string): boolean {
    return this.hasPermission(ctx, `${entity}.manage` as PermissionKey);
  }

  isFrozen(ctx: PermissionContext): boolean {
    return ctx.status === 'frozen';
  }

  isAdmin(ctx: PermissionContext): boolean {
    return ctx.role === 'group_admin' || ctx.role === 'creator';
  }

  isManager(ctx: PermissionContext): boolean {
    return ctx.role === 'group_admin' || ctx.role === 'creator' || ctx.role === 'manager';
  }

  async getPermissionContext(groupId: string, userId: string): Promise<PermissionContext | null> {
    const member = await MemberRepository.getByGroupIdAndUserId(groupId, userId);
    if (!member) return null;

    return {
      groupId,
      userId,
      role: member.role,
      status: member.status,
      permissions: member.permissions || {},
    };
  }
}

export const PermissionsManager = new PermissionsManagerClass();
export { ROLE_DEFAULTS };