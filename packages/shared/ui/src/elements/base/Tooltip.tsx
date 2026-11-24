import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';

import { styledPart } from '../_internal/elementFactory';

import overlayStyles from '../_styles/overlay.module.css';

export const Tooltip = {
  Provider: BaseTooltip.Provider,
  Root: BaseTooltip.Root,
  Trigger: BaseTooltip.Trigger,
  Portal: BaseTooltip.Portal,
  Positioner: styledPart(
    BaseTooltip.Positioner,
    overlayStyles.tooltipPositioner,
    'Tooltip.Positioner',
  ),
  Popup: styledPart(BaseTooltip.Popup, overlayStyles.tooltipPopup, 'Tooltip.Popup'),
  Viewport: styledPart(BaseTooltip.Viewport, overlayStyles.floatingViewport, 'Tooltip.Viewport'),
  Arrow: styledPart(BaseTooltip.Arrow, overlayStyles.arrow, 'Tooltip.Arrow'),
  Handle: BaseTooltip.Handle,
  createHandle: BaseTooltip.createHandle,
} as const;

export type TooltipHandle<Payload = unknown> = BaseTooltip.Handle<Payload>;

export type {
  TooltipArrowProps,
  TooltipArrowState,
  TooltipPopupProps,
  TooltipPopupState,
  TooltipPortalProps,
  TooltipPortalState,
  TooltipPositionerProps,
  TooltipPositionerState,
  TooltipProviderProps,
  TooltipRootActions,
  TooltipRootChangeEventDetails,
  TooltipRootChangeEventReason,
  TooltipRootProps,
  TooltipRootState,
  TooltipTriggerProps,
  TooltipTriggerState,
  TooltipViewportProps,
  TooltipViewportState,
} from '@base-ui/react/tooltip';
