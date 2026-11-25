import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';

import {
  createSlot,
  cx,
  type SlotProps,
  styledPart,
  viewportStyledPart,
} from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import overlayMobileStyles from '../_styles/overlay-mobile.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export type AlertDialogActionsProps = SlotProps<'div'>;
export type AlertDialogHandle<Payload = unknown> = BaseAlertDialog.Handle<Payload>;

export const AlertDialog = {
  Root: BaseAlertDialog.Root,
  Trigger: styledPart(BaseAlertDialog.Trigger, controlStyles.button, 'AlertDialog.Trigger'),
  Portal: BaseAlertDialog.Portal,
  Backdrop: viewportStyledPart(
    BaseAlertDialog.Backdrop,
    cx(overlayStyles.backdrop, overlayMobileStyles.sheetBackdrop),
    'AlertDialog.Backdrop',
  ),
  Viewport: viewportStyledPart(
    BaseAlertDialog.Viewport,
    cx(overlayStyles.viewport, overlayMobileStyles.sheetViewport),
    'AlertDialog.Viewport',
  ),
  Popup: viewportStyledPart(
    BaseAlertDialog.Popup,
    cx(overlayStyles.dialogPopup, overlayStyles.alertPopup, overlayMobileStyles.sheetPopup),
    'AlertDialog.Popup',
    { mobileSheet: true },
  ),
  Title: styledPart(BaseAlertDialog.Title, overlayStyles.title, 'AlertDialog.Title'),
  Description: styledPart(
    BaseAlertDialog.Description,
    overlayStyles.description,
    'AlertDialog.Description',
  ),
  Actions: createSlot('div', overlayStyles.dialogFooter, 'AlertDialog.Actions'),
  Close: styledPart(BaseAlertDialog.Close, overlayStyles.close, 'AlertDialog.Close'),
  Handle: BaseAlertDialog.Handle,
  createHandle: BaseAlertDialog.createHandle,
} as const;

export type {
  AlertDialogBackdropProps,
  AlertDialogBackdropState,
  AlertDialogCloseProps,
  AlertDialogCloseState,
  AlertDialogDescriptionProps,
  AlertDialogDescriptionState,
  AlertDialogPopupProps,
  AlertDialogPopupState,
  AlertDialogPortalProps,
  AlertDialogPortalState,
  AlertDialogRootActions,
  AlertDialogRootChangeEventDetails,
  AlertDialogRootChangeEventReason,
  AlertDialogRootProps,
  AlertDialogRootState,
  AlertDialogTitleProps,
  AlertDialogTitleState,
  AlertDialogTriggerProps,
  AlertDialogTriggerState,
  AlertDialogViewportProps,
  AlertDialogViewportState,
} from '@base-ui/react/alert-dialog';
