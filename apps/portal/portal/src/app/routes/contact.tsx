import type { ContactActionResult, PortalContactLoaderData } from '@aklapper/core';
import { loadPortalContactDataWithPrerender } from '@aklapper/db';
import { usePaneNavigation } from '@aklapper/ui';
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaArgs,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
} from 'react-router';

import { PortalContactPage } from '#pages/contact';

import { processContactSubmission } from '../contact-submission.server';
import { runPaneSafeLoader, unwrapPaneLoaderData } from '../pane-loader';
import { buildPortalPageMeta } from '../seo';

export async function loader({ request }: LoaderFunctionArgs) {
  return runPaneSafeLoader<PortalContactLoaderData>(request, () =>
    loadPortalContactDataWithPrerender(),
  );
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  const resolved = unwrapPaneLoaderData(loaderData);
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Contact // andrew-k.us',
    description:
      resolved?.content.description ??
      'Direct TUI contact form backed by recursive Zod/JSON schema validation and PostgreSQL 19 CHECK constraints.',
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { payload, status } = await processContactSubmission(request);
  return data<ContactActionResult>(payload, { status });
}

export default function PortalContactRoute() {
  const { content } = useLoaderData() as PortalContactLoaderData;
  const actionData = useActionData<typeof action>() as ContactActionResult | undefined;
  const navigation = useNavigation();
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <PortalContactPage
      content={content}
      actionData={actionData}
      isSubmitting={navigation.state === 'submitting'}
      formAction='/contact'
      onClose={() => {
        if (paneNav?.docked) {
          paneNav.exitTui();
        } else {
          void navigate('/');
        }
      }}
    />
  );
}
