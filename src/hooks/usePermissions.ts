import { useGroup } from '@/context/GroupContext';
import { PermissionsManager, PermissionContext, PermissionKey } from '@/permissions/PermissionsManager';

export function usePermissions() {
  const { permissionContext } = useGroup();

  if (!permissionContext) {
    return {
      can: (_key: PermissionKey) => false,
      canCreate: (_entity: string) => false,
      canUpdate: (_entity: string) => false,
      canDelete: (_entity: string) => false,
      canManage: (_entity: string) => false,
      isFrozen: () => false,
      isAdmin: () => false,
      isManager: () => false,
      permissionContext: null,
    };
  }

  return {
    can: (key: PermissionKey) => PermissionsManager.hasPermission(permissionContext, key),
    canCreate: (entity: string) => PermissionsManager.canCreate(permissionContext, entity),
    canUpdate: (entity: string) => PermissionsManager.canUpdate(permissionContext, entity),
    canDelete: (entity: string) => PermissionsManager.canDelete(permissionContext, entity),
    canManage: (entity: string) => PermissionsManager.canManage(permissionContext, entity),
    isFrozen: () => PermissionsManager.isFrozen(permissionContext),
    isAdmin: () => PermissionsManager.isAdmin(permissionContext),
    isManager: () => PermissionsManager.isManager(permissionContext),
    permissionContext,
  };
}