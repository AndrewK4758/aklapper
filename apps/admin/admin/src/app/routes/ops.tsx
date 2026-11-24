import {
  AdminGateOverrideSchema,
  type AdminOpsLoaderData,
  AdminWakeDeploymentSchema,
} from '@aklapper/core';
import { getSharedDb, listAdminSandboxRuns, overrideSandboxGateVerdict } from '@aklapper/db';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaArgs,
  useActionData,
  useLoaderData,
} from 'react-router';

import { type AdminOpsActionData, AdminOpsPage } from '#pages/ops';

import {
  fetchCadenceAdminStatus,
  fetchQdrantStatus,
  forwardCadenceGateOverride,
  requireAdminSession,
  triggerClusterWake,
  triggerQdrantReindex,
} from '../admin-ops.server';
import { buildAdminPageMeta } from '../seo';

export async function loader({ request }: LoaderFunctionArgs): Promise<AdminOpsLoaderData> {
  await requireAdminSession(request);
  const [cadenceAdminStatus, qdrantStatus, sandboxRuns] = await Promise.all([
    fetchCadenceAdminStatus(),
    fetchQdrantStatus(),
    listAdminSandboxRuns(getSharedDb(), 25),
  ]);

  return {
    cadenceAdminStatus,
    qdrantStatus,
    sandboxRuns,
    k8sWatchConfigured: Boolean(process.env['K8S_WATCH_URL']?.trim()),
  };
}

export async function action({ request }: ActionFunctionArgs): Promise<AdminOpsActionData> {
  await requireAdminSession(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');

  try {
    if (intent === 'wake-deployment') {
      const { deployment } = AdminWakeDeploymentSchema.parse({
        deployment: formData.get('deployment'),
      });
      const result = await triggerClusterWake(deployment);
      return { ok: result.ok, message: result.message };
    }

    if (intent === 'override-gate') {
      const parsed = AdminGateOverrideSchema.parse({
        runId: formData.get('runId'),
        gateVerdict: formData.get('gateVerdict'),
      });
      const updated = await overrideSandboxGateVerdict(
        getSharedDb(),
        parsed.runId,
        parsed.gateVerdict,
      );
      if (!updated) {
        return { ok: false, message: `Sandbox run ${parsed.runId} not found.` };
      }
      await forwardCadenceGateOverride(parsed.runId, parsed.gateVerdict);
      return {
        ok: true,
        message: `Updated gate verdict for run ${parsed.runId} to "${updated.gateVerdict}".`,
      };
    }

    if (intent === 'reindex-qdrant') {
      const result = await triggerQdrantReindex();
      return { ok: result.ok, message: result.message };
    }

    return { ok: false, message: `Unsupported ops action: ${intent}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Ops action failed validation.',
    };
  }
}

export function meta({ matches, location }: MetaArgs<typeof loader>) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Cluster & CADENCE Ops // admin.andrew-k.us',
    description:
      'Dual-namespace GKE pod watcher, cadence-admin runtime controls, Qdrant index management, and CHORD gate audit.',
  });
}

export default function AdminOpsRoute() {
  const data = useLoaderData() as AdminOpsLoaderData;
  const actionData = useActionData() as AdminOpsActionData | undefined;
  return <AdminOpsPage data={data} actionData={actionData ?? null} />;
}
