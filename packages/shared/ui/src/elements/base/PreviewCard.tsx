import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card';

import { cx, viewportStyledPart } from '../_internal/elementFactory';

import overlayMobileStyles from '../_styles/overlay-mobile.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const PreviewCard = {
  Root: BasePreviewCard.Root,
  Trigger: BasePreviewCard.Trigger,
  Portal: BasePreviewCard.Portal,
  Backdrop: viewportStyledPart(
    BasePreviewCard.Backdrop,
    cx(overlayStyles.backdrop, overlayMobileStyles.sheetBackdrop),
    'PreviewCard.Backdrop',
  ),
  Positioner: viewportStyledPart(
    BasePreviewCard.Positioner,
    cx(overlayStyles.positioner, overlayMobileStyles.sheetPositioner),
    'PreviewCard.Positioner',
  ),
  Popup: viewportStyledPart(
    BasePreviewCard.Popup,
    cx(overlayStyles.floatingPopup, overlayMobileStyles.sheetPopup),
    'PreviewCard.Popup',
    { mobileSheet: true },
  ),
  Viewport: viewportStyledPart(
    BasePreviewCard.Viewport,
    overlayStyles.floatingViewport,
    'PreviewCard.Viewport',
  ),
  Arrow: viewportStyledPart(
    BasePreviewCard.Arrow,
    cx(overlayStyles.arrow, overlayMobileStyles.sheetArrow),
    'PreviewCard.Arrow',
  ),
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
