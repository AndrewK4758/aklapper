import { Popover as BasePopover } from '@base-ui/react/popover';

import { cx, styledPart, viewportStyledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import overlayMobileStyles from '../_styles/overlay-mobile.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const Popover = {
  Root: BasePopover.Root,
  Trigger: styledPart(BasePopover.Trigger, controlStyles.button, 'Popover.Trigger'),
  Portal: BasePopover.Portal,
  Backdrop: viewportStyledPart(
    BasePopover.Backdrop,
    cx(overlayStyles.backdrop, overlayMobileStyles.sheetBackdrop),
    'Popover.Backdrop',
  ),
  Positioner: viewportStyledPart(
    BasePopover.Positioner,
    cx(overlayStyles.positioner, overlayMobileStyles.sheetPositioner),
    'Popover.Positioner',
  ),
  Popup: viewportStyledPart(
    BasePopover.Popup,
    cx(overlayStyles.floatingPopup, overlayMobileStyles.sheetPopup),
    'Popover.Popup',
    { mobileSheet: true },
  ),
  Viewport: viewportStyledPart(
    BasePopover.Viewport,
    overlayStyles.floatingViewport,
    'Popover.Viewport',
  ),
  Arrow: viewportStyledPart(
    BasePopover.Arrow,
    cx(overlayStyles.arrow, overlayMobileStyles.sheetArrow),
    'Popover.Arrow',
  ),
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
