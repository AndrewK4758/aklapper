import { Toast as BaseToast } from '@base-ui/react/toast';

import { cx, styledPart } from '../_internal/elementFactory';

import overlayStyles from '../_styles/overlay.module.css';

export const Toast = {
  Provider: BaseToast.Provider,
  Portal: BaseToast.Portal,
  Viewport: styledPart(BaseToast.Viewport, overlayStyles.toastViewport, 'Toast.Viewport'),
  Positioner: styledPart(BaseToast.Positioner, overlayStyles.toastPositioner, 'Toast.Positioner'),
  Root: styledPart(BaseToast.Root, overlayStyles.toastRoot, 'Toast.Root'),
  Content: styledPart(BaseToast.Content, overlayStyles.toastContent, 'Toast.Content'),
  Title: styledPart(BaseToast.Title, overlayStyles.title, 'Toast.Title'),
  Description: styledPart(BaseToast.Description, overlayStyles.description, 'Toast.Description'),
  Action: styledPart(
    BaseToast.Action,
    cx(overlayStyles.close, overlayStyles.toastAction),
    'Toast.Action',
  ),
  Close: styledPart(BaseToast.Close, overlayStyles.close, 'Toast.Close'),
  Arrow: styledPart(BaseToast.Arrow, overlayStyles.arrow, 'Toast.Arrow'),
  useToastManager: BaseToast.useToastManager,
  createToastManager: BaseToast.createToastManager,
} as const;

export type {
  ToastActionProps,
  ToastActionState,
  ToastArrowProps,
  ToastArrowState,
  ToastCloseProps,
  ToastCloseState,
  ToastContentProps,
  ToastContentState,
  ToastDescriptionProps,
  ToastDescriptionState,
  ToastManagerAddOptions,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
  ToastObject,
  ToastPortalProps,
  ToastPortalState,
  ToastPositionerProps,
  ToastPositionerState,
  ToastProviderProps,
  ToastRootProps,
  ToastRootState,
  ToastTitleProps,
  ToastTitleState,
  ToastViewportProps,
  ToastViewportState,
} from '@base-ui/react/toast';
