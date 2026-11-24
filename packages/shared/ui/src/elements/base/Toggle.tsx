import { Toggle as BaseToggle } from '@base-ui/react/toggle';

import { createSlot, type SlotProps, styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';

export type ToggleLabelProps = SlotProps<'span'>;
export type ToggleIconProps = SlotProps<'span'>;

const ToggleRoot = styledPart(BaseToggle, controlStyles.toggle, 'Toggle.Root');
const ToggleLabel = createSlot('span', controlStyles.buttonLabel, 'Toggle.Label');
const ToggleIcon = createSlot('span', controlStyles.buttonIcon, 'Toggle.Icon');

export const Toggle = Object.assign(ToggleRoot, {
  Root: ToggleRoot,
  Label: ToggleLabel,
  Icon: ToggleIcon,
});

export type {
  ToggleChangeEventDetails,
  ToggleChangeEventReason,
  ToggleProps,
  ToggleState,
} from '@base-ui/react/toggle';
