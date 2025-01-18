import type { SxProps } from '@mui/material/styles';
import Theme from './theme';
import type { CSSProperties } from 'react';
import { flexColumnStyles } from './pages-styles';

export const baseCrudDisplayStyleSxProps: SxProps = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center'
};

export const crudPaperSxProps: SxProps = {
  width: '70vw',
  [Theme.breakpoints.down('lg')]: {
    width: '90vw'
  }
};

export const crudHomeContainerSxProps: SxProps = {
  flex: '0 1 60%',
  borderRadius: 1
};

export const crudHeaderTextSxProps: SxProps = {
  [Theme.breakpoints.down('lg')]: {
    fontSize: '0.875rem'
  }
};
// export const crudHomeTextStyles: SxProps = {
//   flex: 1,
//   textAlign: 'center'
// };

export const crudButtonSxProps: SxProps = {
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem'
  }
};

export const searchBoxCardSxProps: SxProps = {
  display: 'flex',
  borderRadius: 1,
  width: '60vw',
  [Theme.breakpoints.down('lg')]: {
    width: '90vw',
    paddingLeft: 1
  }
};

export const crudSearchCloseButtonBoxSxProps: SxProps = {
  flex: 1,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  height: '100%'
};

export const searchBoxResultsWrapperSxProps: SxProps = {
  display: 'flex',
  flexDirection: 'column',
  flexWrap: 'wrap',
  maxHeight: '70vh'
};

export const AddEntryModalStyle: SxProps = {
  border: '7.5px solid purple',
  borderRadius: 1,
  [Theme.breakpoints.down('lg')]: {
    border: '3.75px solid purple',
    p: 1
  }
};

export const crudAppWrapperStyles: SxProps = {
  width: '90vw',
  minHeight: '30vh',
  height: 'fit-content',
  borderRadius: 1
};

export const crudAddButtonStyles: SxProps = { m: 1, flex: '1 0 30%', fontSize: '1rem' };

export const crudAddErrorTextStyles: SxProps = { fontSize: '1.25rem' };

export const dataGridStyleUpdate: SxProps = {
  color: '#1f1f1f',
  fontSize: '.875rem',
  fontFamily: 'monospace',
  '& .MuiDataGrid-columnHeader': {
    backgroundColor: '#FFFFFF'
  },
  '& .MuiDataGrid-scrollbarFiller--header': {
    backgroundColor: 'white'
  },
  '& .MuiToolbar-root': {
    color: '#1f1f1f'
  },
  '& .MuiTablePagination-selectLabel': {
    fontSize: '1rem',
    fontFamily: 'Mono'
  },
  '& .MuiTablePagination-displayedRows': {
    fontSize: '1rem',
    fontFamily: 'Mono'
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontSize: '.7rem'
  }
};
//-----------Add Entry-----------//

export const addEntryFormCssProps: CSSProperties = {
  ...(flexColumnStyles as CSSProperties),
  overflowY: 'auto',
  overflowX: 'hidden'
};

export const addEntryDialogTitleSxProps: SxProps = {
  textAlign: 'center',
  [Theme.breakpoints.down('lg')]: {
    p: 0
  }
};

export const addEntryTitleTextSxProps: SxProps = {
  [Theme.breakpoints.down('lg')]: {
    fontSize: '2rem'
  }
};

export const addEntryDescriptionSxProps: SxProps = {
  fontFamily: 'monospace',
  fontSize: '.875rem',
  [Theme.breakpoints.down('lg')]: {
    fontSize: '0.65rem',
    p: 0.75
  }
};

export const addEntryInputSlotProps = {
  input: {
    sx: { fontSize: '0.875rem' } as SxProps
  }
};

export const addEntryErrorTextSxProps: SxProps = {
  color: Theme.palette.error.main,
  [Theme.breakpoints.down('lg')]: {
    fontSize: '0.75rem'
  }
};

export const addEntryButtonSxProps: SxProps = {
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem'
  }
};

export const addEntryStepperButtonBoxSxProps: SxProps = {
  display: 'flex',
  flexDirection: 'row',
  pt: 2,
  [Theme.breakpoints.down('lg')]: {
    m: 0
  }
};

export const addEntryStepperTextSxProps: SxProps = {
  mt: 2,
  mb: 1,
  py: 1,
  [Theme.breakpoints.down('lg')]: {
    m: 0,
    fontSize: '0.875rem',
    p: 0,
    pt: 1
  }
};

export const addEntryStepperNextCompleteButtonSxProps: SxProps = {
  mr: 1,
  color: Theme.palette.text.secondary,
  fontSize: '1rem',
  [Theme.breakpoints.down('lg')]: {
    m: 0,
    p: 0,
    fontSize: '0.875rem'
  }
};
