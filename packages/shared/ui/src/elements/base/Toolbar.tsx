import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar';

import { cx, styledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import controlStyles from '../_styles/control.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';
import menuStyles from '../_styles/menu.module.css';

export const Toolbar = {
  Root: styledPart(
    BaseToolbar.Root,
    cx(menuStyles.bar, controlMobileStyles.touchStrip),
    'Toolbar.Root',
  ),
  Group: styledPart(BaseToolbar.Group, menuStyles.barGroup, 'Toolbar.Group'),
  Button: styledPart(
    BaseToolbar.Button,
    cx(controlStyles.button, controlMobileStyles.touchTarget),
    'Toolbar.Button',
  ),
  Link: styledPart(
    BaseToolbar.Link,
    cx(menuStyles.navLink, controlMobileStyles.touchTarget),
    'Toolbar.Link',
  ),
  Input: styledPart(
    BaseToolbar.Input,
    cx(controlStyles.input, controlMobileStyles.touchInput),
    'Toolbar.Input',
  ),
  Separator: styledPart(BaseToolbar.Separator, disclosureStyles.separator, 'Toolbar.Separator'),
} as const;

export type {
  Orientation as ToolbarOrientation,
  ToolbarButtonProps,
  ToolbarButtonState,
  ToolbarGroupProps,
  ToolbarGroupState,
  ToolbarInputProps,
  ToolbarInputState,
  ToolbarLinkProps,
  ToolbarLinkState,
  ToolbarRootProps,
  ToolbarRootState,
  ToolbarSeparatorProps,
} from '@base-ui/react/toolbar';
