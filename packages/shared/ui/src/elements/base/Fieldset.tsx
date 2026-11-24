import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset';

import { styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';

export const Fieldset = {
  Root: styledPart(BaseFieldset.Root, disclosureStyles.fieldsetRoot, 'Fieldset.Root'),
  Legend: styledPart(BaseFieldset.Legend, disclosureStyles.fieldsetLegend, 'Fieldset.Legend'),
} as const;

export type {
  FieldsetLegendProps,
  FieldsetLegendState,
  FieldsetRootProps,
  FieldsetRootState,
} from '@base-ui/react/fieldset';
