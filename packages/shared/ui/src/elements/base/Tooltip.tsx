import {
  Tooltip as BaseTooltip,
  type TooltipRootChangeEventDetails,
  type TooltipRootProps as BaseTooltipRootProps,
  type TooltipTriggerProps as BaseTooltipTriggerProps,
} from '@base-ui/react/tooltip';
import {
  createContext,
  type JSX,
  type MouseEvent,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

import {
  type ElementViewMode,
  resolveElementViewport,
} from '../../components/terminalViewportSplit';
import { useViewportContext } from '../../components/ViewportProvider';
import { cx, viewportStyledPart } from '../_internal/elementFactory';

import overlayMobileStyles from '../_styles/overlay-mobile.module.css';
import overlayStyles from '../_styles/overlay.module.css';

interface MobileTooltipToggleContextValue {
  readonly isMobile: boolean;
  readonly onTriggerPointerDown: () => void;
  readonly onTriggerClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

const MobileTooltipToggleContext = createContext<MobileTooltipToggleContextValue | null>(null);

export interface TooltipRootProps extends BaseTooltipRootProps {
  readonly viewMode?: ElementViewMode;
}

function TooltipRoot({
  viewMode,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: TooltipRootProps): JSX.Element {
  const { layoutMode } = useViewportContext();
  const resolvedViewport = resolveElementViewport(layoutMode, viewMode);
  const isMobile = resolvedViewport !== 'desktop';
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const openBeforePointerDownRef = useRef<boolean | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange: BaseTooltipRootProps['onOpenChange'] = useCallback(
    (nextOpen: boolean, eventDetails: TooltipRootChangeEventDetails) => {
      if (eventDetails.reason === 'trigger-press') {
        return;
      }
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen, eventDetails);
    },
    [isControlled, onOpenChange],
  );

  const onTriggerPointerDown = useCallback(() => {
    openBeforePointerDownRef.current = open;
  }, [open]);

  const onTriggerClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const baseOpen = openBeforePointerDownRef.current ?? open;
      openBeforePointerDownRef.current = null;
      const nextOpen = !baseOpen;
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      if (onOpenChange) {
        const syntheticDetails = {
          reason: 'trigger-press',
          event: event.nativeEvent,
          cancel: () => {},
          allowPropagation: () => {},
          isCanceled: false,
          isPropagationAllowed: false,
          trigger: event.currentTarget,
        } as unknown as TooltipRootChangeEventDetails;
        onOpenChange(nextOpen, syntheticDetails);
      }
    },
    [isControlled, onOpenChange, open],
  );

  if (!isMobile) {
    return (
      <BaseTooltip.Root
        {...props}
        open={controlledOpen}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
      >
        {children}
      </BaseTooltip.Root>
    );
  }

  return (
    <MobileTooltipToggleContext.Provider
      value={{ isMobile: true, onTriggerPointerDown, onTriggerClick }}
    >
      <BaseTooltip.Root {...props} open={open} onOpenChange={handleOpenChange}>
        {children}
      </BaseTooltip.Root>
    </MobileTooltipToggleContext.Provider>
  );
}

TooltipRoot.displayName = 'Tooltip.Root';

function TooltipTrigger({
  onClick,
  onPointerDown,
  ...props
}: BaseTooltipTriggerProps): JSX.Element {
  const mobileCtx = useContext(MobileTooltipToggleContext);

  if (!mobileCtx?.isMobile) {
    return <BaseTooltip.Trigger {...props} onPointerDown={onPointerDown} onClick={onClick} />;
  }

  const handlePointerDown: NonNullable<BaseTooltipTriggerProps['onPointerDown']> = event => {
    mobileCtx.onTriggerPointerDown();
    onPointerDown?.(event);
  };

  const handleClick: NonNullable<BaseTooltipTriggerProps['onClick']> = event => {
    mobileCtx.onTriggerClick(event);
    onClick?.(event);
  };

  return <BaseTooltip.Trigger {...props} onPointerDown={handlePointerDown} onClick={handleClick} />;
}

TooltipTrigger.displayName = 'Tooltip.Trigger';

export const Tooltip = {
  Provider: BaseTooltip.Provider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Portal: BaseTooltip.Portal,
  Positioner: viewportStyledPart(
    BaseTooltip.Positioner,
    overlayStyles.tooltipPositioner,
    'Tooltip.Positioner',
  ),
  Popup: viewportStyledPart(
    BaseTooltip.Popup,
    cx(overlayStyles.tooltipPopup, overlayMobileStyles.mobileTooltipPopup),
    'Tooltip.Popup',
  ),
  Viewport: viewportStyledPart(
    BaseTooltip.Viewport,
    overlayStyles.floatingViewport,
    'Tooltip.Viewport',
  ),
  Arrow: viewportStyledPart(
    BaseTooltip.Arrow,
    cx(overlayStyles.arrow, overlayMobileStyles.sheetArrow),
    'Tooltip.Arrow',
  ),
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
  TooltipRootState,
  TooltipTriggerProps,
  TooltipTriggerState,
  TooltipViewportProps,
  TooltipViewportState,
} from '@base-ui/react/tooltip';
