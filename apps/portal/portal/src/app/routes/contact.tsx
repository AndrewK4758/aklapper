import type { ContactActionResult, PortalContactLoaderData } from '@aklapper/core';
import { loadPortalContactDataWithPrerender } from '@aklapper/db';
import {
  type ActionFunctionArgs,
  data,
  type MetaArgs,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
} from 'react-router';

import { PortalContactPage } from '#pages/contact';

import { processContactSubmission } from '../contact-submission.server';
import { buildPortalPageMeta } from '../seo';

export async function loader(): Promise<PortalContactLoaderData> {
  return loadPortalContactDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Contact // andrew-k.us',
    description:
      loaderData?.content.description ??
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

  return (
    <PortalContactPage
      content={content}
      actionData={actionData}
      isSubmitting={navigation.state === 'submitting'}
      onClose={() => {
        void navigate('/');
      }}
    />
  );
}
