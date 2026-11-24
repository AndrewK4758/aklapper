import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group';

import { styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';

const ToggleGroupRoot = styledPart(BaseToggleGroup, controlStyles.toggleGroup, 'ToggleGroup.Root');

export const ToggleGroup = Object.assign(ToggleGroupRoot, {
  Root: ToggleGroupRoot,
});

export type {
  ToggleGroupChangeEventDetails,
  ToggleGroupChangeEventReason,
  ToggleGroupProps,
  ToggleGroupState,
} from '@base-ui/react/toggle-group';
