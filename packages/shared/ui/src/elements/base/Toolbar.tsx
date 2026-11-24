import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar';

import { styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';
import menuStyles from '../_styles/menu.module.css';

export const Toolbar = {
  Root: styledPart(BaseToolbar.Root, menuStyles.bar, 'Toolbar.Root'),
  Group: styledPart(BaseToolbar.Group, menuStyles.barGroup, 'Toolbar.Group'),
  Button: styledPart(BaseToolbar.Button, controlStyles.button, 'Toolbar.Button'),
  Link: styledPart(BaseToolbar.Link, menuStyles.navLink, 'Toolbar.Link'),
  Input: styledPart(BaseToolbar.Input, controlStyles.input, 'Toolbar.Input'),
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
