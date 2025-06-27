import { enUS } from '@mui/x-date-pickers/locales';
import {
  BACKGROUND_ALT,
  BACKGROUND_DEFAULT,
  BACKGROUND_PAPER,
  BASE_BORDER_RADIUS,
  BASE_SPACING,
  BOX_SHADOW_SECONDARY_DARK,
  BUTTON_GROUP_BG,
  MAIN_COLOR_DARK,
  MULT_BORDER_RADIUS,
} from '../base/base_styles';

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
  // MuiTextField: {
  //   slotProps: {
  //     input: {
  //       sx: {
  //         backgroundColor: BACKGROUND_ALT,
  //         width: '100%',
  //       },
  //     },
  //   },
  // },
  // MuiDateCalendar: {
  //   slotProps: {
  //     switchViewIcon: {
  //       sx: {
  //         color: MAIN_COLOR_DARK,
  //       },
  //     },
  //     rightArrowIcon: {
  //       sx: {
  //         color: MAIN_COLOR_DARK,
  //       },
  //     },
  //     leftArrowIcon: {
  //       sx: {
  //         color: MAIN_COLOR_DARK,
  //       },
  //     },
  //     day: {
  //       sx: {
  //         fontSize: '1.25rem',
  //         backgroundColor: BACKGROUND_DEFAULT,
  //         color: MAIN_COLOR_DARK,
  //       },
  //     },
  //   },
  // },
  // MuiTimePicker: {
  //   formatDensity: 'spacious',
  //   slotProps: {
  //     desktopPaper: {
  //       sx: {
  //         backgroundColor: BACKGROUND_DEFAULT,
  //         boxShadow: BOX_SHADOW_SECONDARY_DARK,
  //       },
  //     },
  //     digitalClockSectionItem: {
  //       divider: true,
  //       sx: {
  //         borderRadius: MULT_BORDER_RADIUS - 0.35,
  //         backgroundColor: BACKGROUND_PAPER,
  //       },
  //     },
  //     actionBar: {
  //       sx: {
  //         borderTop: `2px solid ${MAIN_COLOR_DARK}`,
  //         background: BACKGROUND_DEFAULT,
  //         borderBottomLeftRadius: BASE_BORDER_RADIUS,
  //         borderBottomRightRadius: BASE_BORDER_RADIUS,
  //       },
  //     },
  //     textField: {
  //       sx: {
  //         width: '100%',
  //         backgroundColor: BACKGROUND_ALT,
  //         borderRadius: MULT_BORDER_RADIUS,
  //       },
  //     },
  //     openPickerIcon: {
  //       sx: {
  //         color: MAIN_COLOR_DARK,
  //         fontSize: '2rem',
  //       },
  //     },
  //   },
  // },
  // MuiDateTimePicker: {
  //   ampm: true,
  //   slotProps: {
  //     actionBar: {
  //       actions: ['accept', 'cancel'],
  //       sx: {
  //         borderTop: `2px solid ${MAIN_COLOR_DARK}`,
  //         backgroundColor: BACKGROUND_DEFAULT,
  //         borderBottomLeftRadius: BASE_BORDER_RADIUS,
  //         borderBottomRightRadius: BASE_BORDER_RADIUS,
  //       },
  //     },
  //     day: {
  //       sx: {
  //         borderRadius: MULT_BORDER_RADIUS - 0.35,
  //         backgroundColor: BACKGROUND_PAPER,
  //       },
  //     },
  //     desktopPaper: {
  //       sx: {
  //         boxShadow: BOX_SHADOW_SECONDARY_DARK,
  //         backgroundColor: BACKGROUND_DEFAULT,
  //       },
  //     },
  //     digitalClockItem: {
  //       sx: {
  //         backgroundColor: BACKGROUND_PAPER,
  //       },
  //     },

  //     leftArrowIcon: {
  //       sx: {
  //         color: MAIN_COLOR_DARK,
  //       },
  //     },
  //     openPickerIcon: {
  //       sx: {
  //         color: MAIN_COLOR_DARK,
  //         fontSize: '2rem',
  //       },
  //     },
  //     popper: {
  //       popperOptions: {
  //         placement: 'auto-end',
  //       },
  //     },
  //     rightArrowIcon: {
  //       sx: {
  //         color: MAIN_COLOR_DARK,
  //       },
  //     },
  //     textField: {
  //       sx: {
  //         width: '100%',
  //         backgroundColor: BACKGROUND_ALT,
  //         borderRadius: MULT_BORDER_RADIUS,
  //       },
  //     },
  //   },
  // },
  enUS,
};
