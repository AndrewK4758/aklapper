import { Switch as BaseSwitch } from '@base-ui/react/switch';

import { createSlot, type SlotProps, styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';

export type SwitchLabelProps = SlotProps<'label'>;

export const Switch = {
  Root: styledPart(BaseSwitch.Root, controlStyles.switchRoot, 'Switch.Root'),
  Thumb: styledPart(BaseSwitch.Thumb, controlStyles.switchThumb, 'Switch.Thumb'),
  Label: createSlot('label', controlStyles.choiceLabel, 'Switch.Label'),
} as const;

export type {
  SwitchRootChangeEventDetails,
  SwitchRootChangeEventReason,
  SwitchRootProps,
  SwitchRootState,
  SwitchThumbProps,
  SwitchThumbState,
} from '@base-ui/react/switch';
