import type { D1Database } from '@cloudflare/workers-types';
import { generateLicenseKey, generateId } from '../utils/key-generator';
import { verifyAdminKey, unauthorizedResponse } from '../utils/auth';

interface Env { DB: D1Database; ADMIN_API_KEY: string; }

/** GET /admin/licenses — List all licenses */
export async function handleListLicenses(request: Request, env: Env): Promise<Response> {
  if (!verifyAdminKey(request, env)) return unauthorizedResponse();

  const { results } = await env.DB.prepare(
    'SELECT * FROM licenses ORDER BY created_at DESC'
  ).all();

  return Response.json({ licenses: results, total: results.length });
}

/** POST /admin/licenses — Create a new license */
export async function handleCreateLicense(request: Request, env: Env): Promise<Response> {
  if (!verifyAdminKey(request, env)) return unauthorizedResponse();

  const body = await request.json() as {
    tenantName: string;
    plan?: string;
    expiresAt?: string;
    notes?: string;
  };

  if (!body.tenantName) {
    return Response.json({ error: 'tenantName is required' }, { status: 400 });
  }

  const plan = body.plan || 'basic';
  const planDefaults: Record<string, { maxAccounts: number; maxTasks: number }> = {
    basic: { maxAccounts: 10, maxTasks: 50 },
    pro:   { maxAccounts: 30, maxTasks: 200 },
  };
  const defaults = planDefaults[plan] || planDefaults.basic;

  const id = generateId();
  const licenseKey = generateLicenseKey();

  await env.DB.prepare(
    `INSERT INTO licenses (id, license_key, tenant_name, plan, max_accounts, max_tasks, expires_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, licenseKey, body.tenantName, plan,
    defaults.maxAccounts, defaults.maxTasks,
    body.expiresAt || null,
    body.notes || null,
  ).run();

  return Response.json({
    success: true,
    license: {
      id,
      licenseKey,
      tenantName: body.tenantName,
      plan,
      maxAccounts: defaults.maxAccounts,
      maxTasks: defaults.maxTasks,
      expiresAt: body.expiresAt || null,
    },
  }, { status: 201 });
}

/** PATCH /admin/licenses/:id — Update a license */
export async function handleUpdateLicense(request: Request, env: Env, id: string): Promise<Response> {
  if (!verifyAdminKey(request, env)) return unauthorizedResponse();

  const body = await request.json() as {
    active?: boolean;
    plan?: string;
    expiresAt?: string | null;
    tenantName?: string;
    notes?: string;
    maxAccounts?: number;
    maxTasks?: number;
  };

  // Build dynamic update
  const sets: string[] = [];
  const values: any[] = [];

  if (body.active !== undefined) { sets.push('active = ?'); values.push(body.active ? 1 : 0); }
  if (body.tenantName) { sets.push('tenant_name = ?'); values.push(body.tenantName); }
  if (body.notes !== undefined) { sets.push('notes = ?'); values.push(body.notes); }
  if ('expiresAt' in body) { sets.push('expires_at = ?'); values.push(body.expiresAt); }

  if (body.plan) {
    sets.push('plan = ?'); values.push(body.plan);
    const planDefaults: Record<string, { maxAccounts: number; maxTasks: number }> = {
      basic: { maxAccounts: 10, maxTasks: 50 },
      pro:   { maxAccounts: 30, maxTasks: 200 },
    };
    const d = planDefaults[body.plan] || planDefaults.basic;
    if (!body.maxAccounts) { sets.push('max_accounts = ?'); values.push(d.maxAccounts); }
    if (!body.maxTasks) { sets.push('max_tasks = ?'); values.push(d.maxTasks); }
  }
  if (body.maxAccounts) { sets.push('max_accounts = ?'); values.push(body.maxAccounts); }
  if (body.maxTasks) { sets.push('max_tasks = ?'); values.push(body.maxTasks); }

  if (sets.length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  values.push(id);
  await env.DB.prepare(`UPDATE licenses SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

  const updated = await env.DB.prepare('SELECT * FROM licenses WHERE id = ?').bind(id).first();
  return Response.json({ success: true, license: updated });
}

/** DELETE /admin/licenses/:id — Delete a license */
export async function handleDeleteLicense(request: Request, env: Env, id: string): Promise<Response> {
  if (!verifyAdminKey(request, env)) return unauthorizedResponse();

  await env.DB.prepare('DELETE FROM licenses WHERE id = ?').bind(id).run();
  return Response.json({ success: true });
}

/** POST /admin/licenses/:id/unbind — Unbind machine from license */
export async function handleUnbindLicense(request: Request, env: Env, id: string): Promise<Response> {
  if (!verifyAdminKey(request, env)) return unauthorizedResponse();

  await env.DB.prepare('UPDATE licenses SET machine_id = NULL WHERE id = ?').bind(id).run();

  return Response.json({ success: true, message: 'Machine unbound. Tenant can activate on a new machine.' });
}

/** GET /admin/dashboard — Overview stats */
export async function handleDashboard(request: Request, env: Env): Promise<Response> {
  if (!verifyAdminKey(request, env)) return unauthorizedResponse();

  const total = await env.DB.prepare('SELECT COUNT(*) as c FROM licenses').first();
  const active = await env.DB.prepare('SELECT COUNT(*) as c FROM licenses WHERE active = 1').first();
  const expired = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM licenses WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
  ).first();
  const online = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM licenses WHERE last_heartbeat > datetime('now', '-1 hour')"
  ).first();

  return Response.json({
    totalLicenses: (total as any)?.c || 0,
    activeLicenses: (active as any)?.c || 0,
    expiredLicenses: (expired as any)?.c || 0,
    onlineNow: (online as any)?.c || 0,
  });
}
