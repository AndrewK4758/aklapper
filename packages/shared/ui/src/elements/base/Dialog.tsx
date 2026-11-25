import { Dialog as BaseDialog } from '@base-ui/react/dialog';

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

export type DialogHeaderProps = SlotProps<'div'>;
export type DialogBodyProps = SlotProps<'div'>;
export type DialogFooterProps = SlotProps<'div'>;
export type DialogHandle<Payload = unknown> = BaseDialog.Handle<Payload>;

export const Dialog = {
  Root: BaseDialog.Root,
  Trigger: styledPart(BaseDialog.Trigger, controlStyles.button, 'Dialog.Trigger'),
  Portal: BaseDialog.Portal,
  Backdrop: viewportStyledPart(
    BaseDialog.Backdrop,
    cx(overlayStyles.backdrop, overlayMobileStyles.sheetBackdrop),
    'Dialog.Backdrop',
  ),
  Viewport: viewportStyledPart(
    BaseDialog.Viewport,
    cx(overlayStyles.viewport, overlayMobileStyles.sheetViewport),
    'Dialog.Viewport',
  ),
  Popup: viewportStyledPart(
    BaseDialog.Popup,
    cx(overlayStyles.dialogPopup, overlayMobileStyles.sheetPopup),
    'Dialog.Popup',
    { mobileSheet: true },
  ),
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
