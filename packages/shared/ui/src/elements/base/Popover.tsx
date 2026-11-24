import { Popover as BasePopover } from '@base-ui/react/popover';

import { styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const Popover = {
  Root: BasePopover.Root,
  Trigger: styledPart(BasePopover.Trigger, controlStyles.button, 'Popover.Trigger'),
  Portal: BasePopover.Portal,
  Backdrop: styledPart(BasePopover.Backdrop, overlayStyles.backdrop, 'Popover.Backdrop'),
  Positioner: styledPart(BasePopover.Positioner, overlayStyles.positioner, 'Popover.Positioner'),
  Popup: styledPart(BasePopover.Popup, overlayStyles.floatingPopup, 'Popover.Popup'),
  Viewport: styledPart(BasePopover.Viewport, overlayStyles.floatingViewport, 'Popover.Viewport'),
  Arrow: styledPart(BasePopover.Arrow, overlayStyles.arrow, 'Popover.Arrow'),
  Title: styledPart(BasePopover.Title, overlayStyles.title, 'Popover.Title'),
  Description: styledPart(
    BasePopover.Description,
    overlayStyles.description,
    'Popover.Description',
  ),
  Close: styledPart(BasePopover.Close, overlayStyles.close, 'Popover.Close'),
  Handle: BasePopover.Handle,
  createHandle: BasePopover.createHandle,
} as const;

export type PopoverHandle<Payload = unknown> = BasePopover.Handle<Payload>;

export type {
  PopoverArrowProps,
  PopoverArrowState,
  PopoverBackdropProps,
  PopoverBackdropState,
  PopoverCloseProps,
  PopoverCloseState,
  PopoverDescriptionProps,
  PopoverDescriptionState,
  PopoverPopupProps,
  PopoverPopupState,
  PopoverPortalProps,
  PopoverPortalState,
  PopoverPositionerProps,
  PopoverPositionerState,
  PopoverRootActions,
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
  PopoverRootProps,
  PopoverRootState,
  PopoverTitleProps,
  PopoverTitleState,
  PopoverTriggerProps,
  PopoverTriggerState,
  PopoverViewportProps,
  PopoverViewportState,
} from '@base-ui/react/popover';
