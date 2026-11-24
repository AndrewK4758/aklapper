import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card';

import { styledPart } from '../_internal/elementFactory';

import overlayStyles from '../_styles/overlay.module.css';

export const PreviewCard = {
  Root: BasePreviewCard.Root,
  Trigger: BasePreviewCard.Trigger,
  Portal: BasePreviewCard.Portal,
  Backdrop: styledPart(BasePreviewCard.Backdrop, overlayStyles.backdrop, 'PreviewCard.Backdrop'),
  Positioner: styledPart(
    BasePreviewCard.Positioner,
    overlayStyles.positioner,
    'PreviewCard.Positioner',
  ),
  Popup: styledPart(BasePreviewCard.Popup, overlayStyles.floatingPopup, 'PreviewCard.Popup'),
  Viewport: styledPart(
    BasePreviewCard.Viewport,
    overlayStyles.floatingViewport,
    'PreviewCard.Viewport',
  ),
  Arrow: styledPart(BasePreviewCard.Arrow, overlayStyles.arrow, 'PreviewCard.Arrow'),
  Handle: BasePreviewCard.Handle,
  createHandle: BasePreviewCard.createHandle,
} as const;

export type PreviewCardHandle<Payload = unknown> = BasePreviewCard.Handle<Payload>;

export type {
  PreviewCardArrowProps,
  PreviewCardArrowState,
  PreviewCardBackdropProps,
  PreviewCardBackdropState,
  PreviewCardPopupProps,
  PreviewCardPopupState,
  PreviewCardPortalProps,
  PreviewCardPortalState,
  PreviewCardPositionerProps,
  PreviewCardPositionerState,
  PreviewCardRootActions,
  PreviewCardRootChangeEventDetails,
  PreviewCardRootChangeEventReason,
  PreviewCardRootProps,
  PreviewCardRootState,
  PreviewCardTriggerProps,
  PreviewCardTriggerState,
  PreviewCardViewportProps,
  PreviewCardViewportState,
} from '@base-ui/react/preview-card';
