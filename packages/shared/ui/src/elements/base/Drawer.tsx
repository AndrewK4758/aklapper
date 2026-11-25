import { Drawer as BaseDrawer } from '@base-ui/react/drawer';

import {
  createSlot,
  type SlotProps,
  styledPart,
  viewportStyledPart,
} from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export type DrawerHandleBarProps = SlotProps<'div'>;
export type DrawerHandle<Payload = unknown> = BaseDrawer.Handle<Payload>;

export const Drawer = {
  Provider: BaseDrawer.Provider,
  Root: BaseDrawer.Root,
  Trigger: styledPart(BaseDrawer.Trigger, controlStyles.button, 'Drawer.Trigger'),
  SwipeArea: styledPart(BaseDrawer.SwipeArea, overlayStyles.drawerSwipeArea, 'Drawer.SwipeArea'),
  Portal: BaseDrawer.Portal,
  Backdrop: viewportStyledPart(
    BaseDrawer.Backdrop,
    overlayStyles.drawerBackdrop,
    'Drawer.Backdrop',
  ),
  Viewport: viewportStyledPart(
    BaseDrawer.Viewport,
    overlayStyles.drawerViewport,
    'Drawer.Viewport',
  ),
  Popup: viewportStyledPart(BaseDrawer.Popup, overlayStyles.drawerPopup, 'Drawer.Popup'),
  Content: styledPart(BaseDrawer.Content, overlayStyles.drawerContent, 'Drawer.Content'),
  HandleBar: createSlot('div', overlayStyles.drawerHandleBar, 'Drawer.HandleBar'),
  Title: styledPart(BaseDrawer.Title, overlayStyles.title, 'Drawer.Title'),
  Description: styledPart(BaseDrawer.Description, overlayStyles.description, 'Drawer.Description'),
  Close: styledPart(BaseDrawer.Close, overlayStyles.close, 'Drawer.Close'),
  Indent: styledPart(BaseDrawer.Indent, overlayStyles.drawerIndent, 'Drawer.Indent'),
  IndentBackground: styledPart(
    BaseDrawer.IndentBackground,
    overlayStyles.drawerIndentBackground,
    'Drawer.IndentBackground',
  ),
  VirtualKeyboardProvider: BaseDrawer.VirtualKeyboardProvider,
  Handle: BaseDrawer.Handle,
  createHandle: BaseDrawer.createHandle,
} as const;

export type {
  DrawerBackdropProps,
  DrawerBackdropState,
  DrawerCloseProps,
  DrawerCloseState,
  DrawerContentProps,
  DrawerContentState,
  DrawerDescriptionProps,
  DrawerDescriptionState,
  DrawerIndentBackgroundProps,
  DrawerIndentBackgroundState,
  DrawerIndentProps,
  DrawerIndentState,
  DrawerPopupProps,
  DrawerPopupState,
  DrawerPortalProps,
  DrawerPortalState,
  DrawerProviderProps,
  DrawerRootActions,
  DrawerRootChangeEventDetails,
  DrawerRootChangeEventReason,
  DrawerRootProps,
  DrawerRootState,
  DrawerSwipeAreaProps,
  DrawerSwipeAreaState,
  DrawerTitleProps,
  DrawerTitleState,
  DrawerTriggerProps,
  DrawerTriggerState,
  DrawerViewportProps,
  DrawerViewportState,
} from '@base-ui/react/drawer';
