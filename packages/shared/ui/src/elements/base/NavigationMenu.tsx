import { NavigationMenu as BaseNavigationMenu } from '@base-ui/react/navigation-menu';

import { cx, styledPart, viewportStyledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import menuStyles from '../_styles/menu.module.css';
import overlayMobileStyles from '../_styles/overlay-mobile.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const NavigationMenu = {
  Root: styledPart(BaseNavigationMenu.Root, menuStyles.navRoot, 'NavigationMenu.Root'),
  List: styledPart(
    BaseNavigationMenu.List,
    cx(menuStyles.navList, controlMobileStyles.touchStrip),
    'NavigationMenu.List',
  ),
  Item: styledPart(BaseNavigationMenu.Item, menuStyles.navItem, 'NavigationMenu.Item'),
  Trigger: styledPart(BaseNavigationMenu.Trigger, menuStyles.navLink, 'NavigationMenu.Trigger'),
  Icon: styledPart(BaseNavigationMenu.Icon, menuStyles.icon, 'NavigationMenu.Icon'),
  Content: styledPart(BaseNavigationMenu.Content, menuStyles.navContent, 'NavigationMenu.Content'),
  Link: styledPart(BaseNavigationMenu.Link, menuStyles.navLink, 'NavigationMenu.Link'),
  Portal: BaseNavigationMenu.Portal,
  Backdrop: viewportStyledPart(
    BaseNavigationMenu.Backdrop,
    cx(overlayStyles.backdrop, overlayMobileStyles.sheetBackdrop),
    'NavigationMenu.Backdrop',
  ),
  Positioner: viewportStyledPart(
    BaseNavigationMenu.Positioner,
    cx(menuStyles.positioner, overlayMobileStyles.sheetPositioner),
    'NavigationMenu.Positioner',
  ),
  Popup: viewportStyledPart(
    BaseNavigationMenu.Popup,
    cx(menuStyles.popup, overlayMobileStyles.sheetPopup),
    'NavigationMenu.Popup',
    { mobileSheet: true },
  ),
  Viewport: viewportStyledPart(
    BaseNavigationMenu.Viewport,
    overlayStyles.floatingViewport,
    'NavigationMenu.Viewport',
  ),
  Arrow: viewportStyledPart(
    BaseNavigationMenu.Arrow,
    cx(overlayStyles.arrow, overlayMobileStyles.sheetArrow),
    'NavigationMenu.Arrow',
  ),
} as const;

export type {
  NavigationMenuArrowProps,
  NavigationMenuArrowState,
  NavigationMenuBackdropProps,
  NavigationMenuBackdropState,
  NavigationMenuContentProps,
  NavigationMenuContentState,
  NavigationMenuIconProps,
  NavigationMenuIconState,
  NavigationMenuItemProps,
  NavigationMenuItemState,
  NavigationMenuLinkProps,
  NavigationMenuLinkState,
  NavigationMenuListProps,
  NavigationMenuListState,
  NavigationMenuPopupProps,
  NavigationMenuPopupState,
  NavigationMenuPortalProps,
  NavigationMenuPortalState,
  NavigationMenuPositionerProps,
  NavigationMenuPositionerState,
  NavigationMenuRootChangeEventDetails,
  NavigationMenuRootChangeEventReason,
  NavigationMenuRootProps,
  NavigationMenuRootState,
  NavigationMenuTriggerProps,
  NavigationMenuTriggerState,
  NavigationMenuViewportProps,
  NavigationMenuViewportState,
} from '@base-ui/react/navigation-menu';
