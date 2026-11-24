import { Separator as BaseSeparator } from '@base-ui/react/separator';

import { createSlot, type SlotProps, styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';

export type SeparatorLabelProps = SlotProps<'span'>;

const SeparatorRoot = styledPart(BaseSeparator, disclosureStyles.separator, 'Separator.Root');
const SeparatorLabel = createSlot('span', disclosureStyles.separatorLabel, 'Separator.Label');

export const Separator = Object.assign(SeparatorRoot, {
  Root: SeparatorRoot,
  Label: SeparatorLabel,
});

export type { SeparatorProps, SeparatorState } from '@base-ui/react/separator';
