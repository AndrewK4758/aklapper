import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible';

import { styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';

export const Collapsible = {
  Root: styledPart(BaseCollapsible.Root, disclosureStyles.collapsibleRoot, 'Collapsible.Root'),
  Trigger: styledPart(
    BaseCollapsible.Trigger,
    disclosureStyles.disclosureTrigger,
    'Collapsible.Trigger',
  ),
  Panel: styledPart(BaseCollapsible.Panel, disclosureStyles.disclosurePanel, 'Collapsible.Panel'),
} as const;

export type {
  CollapsiblePanelProps,
  CollapsiblePanelState,
  CollapsibleRootChangeEventDetails,
  CollapsibleRootChangeEventReason,
  CollapsibleRootProps,
  CollapsibleRootState,
  CollapsibleTriggerProps,
  CollapsibleTriggerState,
} from '@base-ui/react/collapsible';
