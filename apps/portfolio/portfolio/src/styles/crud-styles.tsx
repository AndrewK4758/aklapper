import type { SxProps } from '@mui/material/styles';

export const inverseColors: SxProps = {
  backgroundColor: '#FFFFFF',
  color: '#1f1f1f'
};

export const baseCrudDisplayStyleSxProps: SxProps = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center'
};

// export const crudPaperSxProps: SxProps = {
//   ...baseCrudDisplayStyleSxProps,
//   width: '100%'
// };

export const crudHomeContainerSxProps: SxProps = {
  flex: '0 1 60%',
  borderRadius: 1
};

export const crudHomeTextStyles: SxProps = {
  flex: 1,
  textAlign: 'center'
};

export const searchBoxCardSxProps: SxProps = {
  display: 'flex',
  borderRadius: 1,
  width: '60vw'
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
  ...inverseColors,
  minWidth: '50vw',
  maxWidth: '800px',
  minHeight: '50vh',
  maxHeight: 'fit-content',
  border: '7.5px solid purple',
  boxShadow: 24,
  borderRadius: 1
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
