import { Dialog as BaseDialog } from '@base-ui/react/dialog';

import { createSlot, type SlotProps, styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export type DialogHeaderProps = SlotProps<'div'>;
export type DialogBodyProps = SlotProps<'div'>;
export type DialogFooterProps = SlotProps<'div'>;
export type DialogHandle<Payload = unknown> = BaseDialog.Handle<Payload>;

export const Dialog = {
  Root: BaseDialog.Root,
  Trigger: styledPart(BaseDialog.Trigger, controlStyles.button, 'Dialog.Trigger'),
  Portal: BaseDialog.Portal,
  Backdrop: styledPart(BaseDialog.Backdrop, overlayStyles.backdrop, 'Dialog.Backdrop'),
  Viewport: styledPart(BaseDialog.Viewport, overlayStyles.viewport, 'Dialog.Viewport'),
  Popup: styledPart(BaseDialog.Popup, overlayStyles.dialogPopup, 'Dialog.Popup'),
  Header: createSlot('div', overlayStyles.dialogHeader, 'Dialog.Header'),
  Title: styledPart(BaseDialog.Title, overlayStyles.title, 'Dialog.Title'),
  Description: styledPart(BaseDialog.Description, overlayStyles.description, 'Dialog.Description'),
  Body: createSlot('div', overlayStyles.dialogBody, 'Dialog.Body'),
  Footer: createSlot('div', overlayStyles.dialogFooter, 'Dialog.Footer'),
  Close: styledPart(BaseDialog.Close, overlayStyles.close, 'Dialog.Close'),
  Handle: BaseDialog.Handle,
  createHandle: BaseDialog.createHandle,
} as const;

export type {
  DialogBackdropProps,
  DialogBackdropState,
  DialogCloseProps,
  DialogCloseState,
  DialogDescriptionProps,
  DialogDescriptionState,
  DialogPopupProps,
  DialogPopupState,
  DialogPortalProps,
  DialogPortalState,
  DialogRootActions,
  DialogRootChangeEventDetails,
  DialogRootChangeEventReason,
  DialogRootProps,
  DialogRootState,
  DialogTitleProps,
  DialogTitleState,
  DialogTriggerProps,
  DialogTriggerState,
  DialogViewportProps,
  DialogViewportState,
} from '@base-ui/react/dialog';
