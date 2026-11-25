import {
  Tooltip as BaseTooltip,
  type TooltipRootProps as BaseTooltipRootProps,
  type TooltipTriggerProps as BaseTooltipTriggerProps,
} from '@base-ui/react/tooltip';
import { createContext, type JSX, type MouseEvent, useCallback, useContext, useState } from 'react';

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
  readonly toggleOpen: () => void;
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

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange: BaseTooltipRootProps['onOpenChange'] = useCallback(
    (nextOpen: boolean, eventDetails: Parameters<NonNullable<BaseTooltipRootProps['onOpenChange']>>[1]) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen, eventDetails);
    },
    [isControlled, onOpenChange],
  );

  const toggleOpen = useCallback(() => {
    const nextOpen = !open;
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
  }, [isControlled, open]);

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
    <MobileTooltipToggleContext.Provider value={{ isMobile: true, toggleOpen }}>
      <BaseTooltip.Root {...props} open={open} onOpenChange={handleOpenChange}>
        {children}
      </BaseTooltip.Root>
    </MobileTooltipToggleContext.Provider>
  );
}

TooltipRoot.displayName = 'Tooltip.Root';

function TooltipTrigger({ onClick, ...props }: BaseTooltipTriggerProps): JSX.Element {
  const mobileCtx = useContext(MobileTooltipToggleContext);

  if (!mobileCtx?.isMobile) {
    return <BaseTooltip.Trigger {...props} onClick={onClick} />;
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    mobileCtx.toggleOpen();
    onClick?.(event);
  };

  return <BaseTooltip.Trigger {...props} onClick={handleClick} />;
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
