import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group';

import { cx, styledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import controlStyles from '../_styles/control.module.css';

const ToggleGroupRoot = styledPart(
  BaseToggleGroup,
  cx(controlStyles.toggleGroup, controlMobileStyles.touchStrip),
  'ToggleGroup.Root',
);

export const ToggleGroup = Object.assign(ToggleGroupRoot, {
  Root: ToggleGroupRoot,
});

export type {
  ToggleGroupChangeEventDetails,
  ToggleGroupChangeEventReason,
  ToggleGroupProps,
  ToggleGroupState,
} from '@base-ui/react/toggle-group';
