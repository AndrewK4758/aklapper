import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';

import { createSlot, cx, type SlotProps, styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export type AlertDialogActionsProps = SlotProps<'div'>;
export type AlertDialogHandle<Payload = unknown> = BaseAlertDialog.Handle<Payload>;

export const AlertDialog = {
  Root: BaseAlertDialog.Root,
  Trigger: styledPart(BaseAlertDialog.Trigger, controlStyles.button, 'AlertDialog.Trigger'),
  Portal: BaseAlertDialog.Portal,
  Backdrop: styledPart(BaseAlertDialog.Backdrop, overlayStyles.backdrop, 'AlertDialog.Backdrop'),
  Viewport: styledPart(BaseAlertDialog.Viewport, overlayStyles.viewport, 'AlertDialog.Viewport'),
  Popup: styledPart(
    BaseAlertDialog.Popup,
    cx(overlayStyles.dialogPopup, overlayStyles.alertPopup),
    'AlertDialog.Popup',
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
