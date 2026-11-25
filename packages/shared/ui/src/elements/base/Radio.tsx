import { Radio as BaseRadio } from '@base-ui/react/radio';

import { createSlot, cx, type SlotProps, styledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import controlStyles from '../_styles/control.module.css';

export type RadioLabelProps = SlotProps<'label'>;

export const Radio = {
  Root: styledPart(
    BaseRadio.Root,
    cx(controlStyles.radioRoot, controlMobileStyles.touchHitArea),
    'Radio.Root',
  ),
  Indicator: styledPart(BaseRadio.Indicator, controlStyles.radioIndicator, 'Radio.Indicator'),
  Label: createSlot('label', controlStyles.choiceLabel, 'Radio.Label'),
} as const;

export type {
  RadioIndicatorProps,
  RadioIndicatorState,
  RadioRootProps,
  RadioRootState,
} from '@base-ui/react/radio';
