export type WorkspaceAuthorization = {
  allowed: boolean;
  code: string;
  workspace_id?: string | null;
  user_id?: string | null;
  role?: 'owner' | 'admin' | 'editor' | 'viewer' | null;
  membership_active?: boolean;
  can_read?: boolean;
  can_write?: boolean;
  can_manage_members?: boolean;
  can_manage_billing?: boolean;
  subscription?: Record<string, unknown>;
  seats?: Record<string, unknown>;
  entitlement?: Record<string, unknown>;
  [key: string]: unknown;
};

type ResolveOptions = {
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  workspaceId?: string | null;
  action: 'read' | 'resource_read' | 'course_read' | 'write' | 'report_write' | 'export' | 'invite' | 'manage_members' | 'manage_billing';
  resourceType: string;
  requiredPlan?: string | null;
  targetEmail?: string | null;
};

export async function resolveWorkspaceAuthorization(options: ResolveOptions): Promise<WorkspaceAuthorization> {
  const response = await fetch(options.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/resolve_workspace_authorization', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + options.serviceKey,
      apikey: options.serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_workspace_id: options.workspaceId || null,
      p_action: options.action,
      p_resource_type: options.resourceType,
      p_required_plan: options.requiredPlan || null,
      p_target_email: options.targetEmail || null,
      p_user_id: options.userId,
    }),
  });
  if (!response.ok) {
    console.error('workspace authorization unavailable', response.status, (await response.text()).slice(0, 500));
    return { allowed: false, code: 'WORKSPACE_AUTHORIZATION_UNAVAILABLE' };
  }
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { allowed: false, code: 'WORKSPACE_AUTHORIZATION_UNAVAILABLE' };
  }
  return result as WorkspaceAuthorization;
}

export function workspaceAuthorizationStatus(result: WorkspaceAuthorization): number {
  if (result.code === 'AUTH_REQUIRED') return 401;
  if (result.code === 'WORKSPACE_REQUIRED') return 400;
  if (result.code === 'WORKSPACE_SEAT_LIMIT_REACHED' || result.code === 'SUBSCRIPTION_EXPIRED' || result.code === 'PLAN_REQUIRED') return 409;
  if (result.code === 'WORKSPACE_AUTHORIZATION_UNAVAILABLE') return 503;
  return 403;
}
