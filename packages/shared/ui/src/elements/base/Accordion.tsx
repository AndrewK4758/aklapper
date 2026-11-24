import { Accordion as BaseAccordion } from '@base-ui/react/accordion';

import { styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';

export const Accordion = {
  Root: styledPart(BaseAccordion.Root, disclosureStyles.accordionRoot, 'Accordion.Root'),
  Item: styledPart(BaseAccordion.Item, disclosureStyles.accordionItem, 'Accordion.Item'),
  Header: styledPart(BaseAccordion.Header, disclosureStyles.accordionHeader, 'Accordion.Header'),
  Trigger: styledPart(
    BaseAccordion.Trigger,
    disclosureStyles.disclosureTrigger,
    'Accordion.Trigger',
  ),
  Panel: styledPart(BaseAccordion.Panel, disclosureStyles.disclosurePanel, 'Accordion.Panel'),
} as const;

export type {
  AccordionHeaderProps,
  AccordionHeaderState,
  AccordionItemChangeEventDetails,
  AccordionItemChangeEventReason,
  AccordionItemProps,
  AccordionItemState,
  AccordionPanelProps,
  AccordionPanelState,
  AccordionRootChangeEventDetails,
  AccordionRootChangeEventReason,
  AccordionRootProps,
  AccordionRootState,
  AccordionTriggerProps,
  AccordionTriggerState,
  AccordionValue,
} from '@base-ui/react/accordion';
