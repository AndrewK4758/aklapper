import { Radio as BaseRadio } from '@base-ui/react/radio';

import { createSlot, type SlotProps, styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';

export type RadioLabelProps = SlotProps<'label'>;

export const Radio = {
  Root: styledPart(BaseRadio.Root, controlStyles.radioRoot, 'Radio.Root'),
  Indicator: styledPart(BaseRadio.Indicator, controlStyles.radioIndicator, 'Radio.Indicator'),
  Label: createSlot('label', controlStyles.choiceLabel, 'Radio.Label'),
} as const;

export type {
  RadioIndicatorProps,
  RadioIndicatorState,
  RadioRootProps,
  RadioRootState,
} from '@base-ui/react/radio';
