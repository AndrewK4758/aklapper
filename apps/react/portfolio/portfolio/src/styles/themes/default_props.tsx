import { enUS } from '@mui/x-date-pickers/locales';
import { BACKGROUND_ALT, BASE_SPACING, BUTTON_GROUP_BG, MAIN_COLOR_DARK } from '../base/base_styles';

export const DEFAULT_PROPS = {
  MuiCardContent: {
    sx: {
      display: 'flex',
      gap: BASE_SPACING * 6,
    },
  },
  MuiDialog: {
    slotProps: {
      paper: {
        sx: {
          boxShadow: `0 0 0 0.5rem ${MAIN_COLOR_DARK}3A`,
          height: 'fit-content',
          minHeight: '75vh',
        },
      },
      transition: {
        timeout: {
          appear: 2000,
        },
      },
    },
  },
  MuiDivider: {
    sx: {
      backgroundColor: MAIN_COLOR_DARK,
    },
  },
  MuiButtonGroup: {
    fullWidth: true,
    sx: {
      borderRadius: '12px',
      backgroundColor: BUTTON_GROUP_BG,
    },
  },
  MuiSelect: {
    slotProps: {
      input: {
        sx: {
          color: MAIN_COLOR_DARK,
          backgroundColor: BACKGROUND_ALT,
        },
      },
      notchedOutline: {
        sx: {
          color: MAIN_COLOR_DARK,
        },
      },
      root: {
        sx: {
          color: MAIN_COLOR_DARK,
          backgroundColor: BACKGROUND_ALT,
        },
      },
    },
  },
  MuiMenuItem: {
    sx: {
      backgroundColor: BACKGROUND_ALT,
    },
  },
  MuiStack: {
    useFlexGap: true,
    sx: {
      gap: 1,
    },
  },
  enUS,
};
