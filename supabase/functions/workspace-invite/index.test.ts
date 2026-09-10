import { handleWorkspaceInvite } from './index.ts';

type Scenario = {
  member?: boolean;
  mailStatus?: number;
  mailBody?: Record<string, unknown>;
};

const originalFetch = globalThis.fetch;
const envNames = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY', 'WORKSPACE_INVITE_FROM_EMAIL', 'APP_PUBLIC_URL',
];

function configureEnv(mail = true) {
  Deno.env.set('SUPABASE_URL', 'https://project.supabase.co');
  Deno.env.set('SUPABASE_ANON_KEY', 'anon');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service');
  Deno.env.set('APP_PUBLIC_URL', 'https://app.example.test/mercator/');
  Deno.env.set('WORKSPACE_INVITE_FROM_EMAIL', 'JAY Team <team@example.test>');
  if (mail) Deno.env.set('RESEND_API_KEY', 're_test');
  else Deno.env.delete('RESEND_API_KEY');
}

function request(): Request {
  return new Request('https://project.supabase.co/functions/v1/workspace-invite', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer user-token',
      'Content-Type': 'application/json',
      Origin: 'https://lidengrong3-prog.github.io',
    },
    body: JSON.stringify({
      workspace_id: '00000000-0000-4000-8000-000000000010',
      email: 'member@example.test',
      role: 'editor',
    }),
  });
}

function installFetch(scenario: Scenario, patches: Record<string, unknown>[]) {
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: '00000000-0000-4000-8000-000000000001', email: 'owner@example.test' });
    if (url.includes('/workspace_members?')) return Response.json(scenario.member === false ? [] : [{ id: 'membership-1' }]);
    if (url.includes('/workspaces?')) return Response.json([{ id: '00000000-0000-4000-8000-000000000010', name: '测试团队' }]);
    if (url.includes('/profiles?')) return Response.json([]);
    if (url.includes('/workspace_invites?') && (init?.method || 'GET') === 'GET') return Response.json([]);
    if (url.includes('/workspace_invites?') && init?.method === 'POST') {
      return Response.json([{
        id: '00000000-0000-4000-8000-000000000020',
        workspace_id: '00000000-0000-4000-8000-000000000010',
        delivery_attempts: 1,
      }]);
    }
    if (url.includes('/workspace_invites?') && init?.method === 'PATCH') {
      patches.push(JSON.parse(String(init.body || '{}')));
      return new Response(null, { status: 204 });
    }
    if (url === 'https://api.resend.com/emails') {
      return Response.json(scenario.mailBody || { id: 'resend-message-1' }, { status: scenario.mailStatus || 200 });
    }
    throw new Error(`unexpected fetch: ${init?.method || 'GET'} ${url}`);
  };
}

async function withScenario(scenario: Scenario, action: (patches: Record<string, unknown>[]) => Promise<void>) {
  const patches: Record<string, unknown>[] = [];
  configureEnv(true);
  installFetch(scenario, patches);
  try { await action(patches); } finally {
    globalThis.fetch = originalFetch;
    envNames.forEach((name) => Deno.env.delete(name));
  }
}

Deno.test('workspace invitation records confirmed Resend delivery', async () => {
  await withScenario({}, async (patches) => {
    const response = await handleWorkspaceInvite(request());
    const body = await response.json();
    if (response.status !== 200 || body.invitation?.delivery_status !== 'sent') throw new Error(JSON.stringify(body));
    if (!patches.some((row) => row.delivery_status === 'sent' && row.delivery_message_id === 'resend-message-1')) throw new Error('sent provider state was not persisted');
  });
});

Deno.test('workspace invitation records provider rejection and does not claim success', async () => {
  await withScenario({ mailStatus: 422, mailBody: { message: 'sender rejected' } }, async (patches) => {
    const response = await handleWorkspaceInvite(request());
    const body = await response.json();
    if (response.status !== 502 || body.error !== 'INVITE_DELIVERY_FAILED') throw new Error(JSON.stringify(body));
    if (!patches.some((row) => row.delivery_status === 'failed' && row.delivery_error === 'sender rejected')) throw new Error('failed provider state was not persisted');
  });
});

Deno.test('workspace invitation fails closed when mail configuration is absent', async () => {
  await withScenario({}, async () => {
    Deno.env.delete('RESEND_API_KEY');
    const response = await handleWorkspaceInvite(request());
    const body = await response.json();
    if (response.status !== 503 || body.error !== 'INVITE_MAIL_NOT_CONFIGURED') throw new Error(JSON.stringify(body));
  });
});

Deno.test('workspace invitation checks manager permission before delivery', async () => {
  await withScenario({ member: false }, async () => {
    const response = await handleWorkspaceInvite(request());
    const body = await response.json();
    if (response.status !== 403 || body.error !== 'WORKSPACE_FORBIDDEN') throw new Error(JSON.stringify(body));
  });
});
