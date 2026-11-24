import { sanitizeRedirectTarget } from '@aklapper/node-runtime/auth';
import { type LoaderFunctionArgs, type MetaArgs, useLoaderData } from 'react-router';

import { AdminLoginPage } from '#pages/login';

import { buildAdminPageMeta } from '../seo';

export interface AdminLoginLoaderData {
  nextTarget: string;
}

export function loader({ request }: LoaderFunctionArgs): AdminLoginLoaderData {
  const url = new URL(request.url);
  const nextTarget = sanitizeRedirectTarget(url.searchParams.get('next'), '/');
  return {
    nextTarget: nextTarget === '/login' ? '/' : nextTarget,
  };
}

export function meta({ matches, location }: MetaArgs<typeof loader>) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Passkey Sign In // Andrew Klapper Admin',
    description: 'Hardware-backed WebAuthn passkey and TOTP 2FA gate for admin.andrew-k.us.',
  });
}

export default function AdminLoginRoute() {
  const { nextTarget } = useLoaderData() as AdminLoginLoaderData;
  return <AdminLoginPage nextTarget={nextTarget} />;
}
