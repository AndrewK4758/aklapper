import type { artist } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import { useGridApiRef, type GridPaginationModel } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid/components/cell';
import { DataGrid } from '@mui/x-data-grid/DataGrid';
import { GridApiCommunity } from '@mui/x-data-grid/internals';
import type { GridColDef } from '@mui/x-data-grid/models/colDef';
import type { GridRowParams } from '@mui/x-data-grid/models/params';
import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams, type FetcherWithComponents } from 'react-router';
import { DATA_GRID_BG } from '../../../styles/base/base_styles';
import Theme from '../../../styles/themes/theme';
import type { QueryOptions } from '../../../types/types';

export type PaginationModel = {
  pageSize: number;
  page: number;
};

interface ArtistDataGridProps {
  COUNT: number;
  rows: artist[];
  fetcher: FetcherWithComponents<artist>;
}

export default function ArtistDataGrid({ rows, COUNT, fetcher }: ArtistDataGridProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const dgApiRef = useGridApiRef<GridApiCommunity>();
  const nav = useNavigate();

  const take = searchParams.get('take') as string;
  const cursor = searchParams.get('cursor') as string;

  const model: PaginationModel = {
    pageSize: parseInt(take, 10),
    page: parseInt(cursor, 10) === 1 ? 0 : Math.floor(parseInt(cursor, 10) / parseInt(take, 10)),
  };

  const queryOptions: QueryOptions = {
    take: model.pageSize.toString(),
    skip: model.page === 0 ? '0' : '1',
    cursor: model.page === 0 ? '1' : (model.pageSize * model.page).toString(),
  };

  const handleChangePagination = (model: GridPaginationModel) => {
    const newQueryOptions: QueryOptions = {
      take: model.pageSize.toString(),
      skip: model.page === 0 ? '0' : '1',
      cursor: model.page === 0 ? '1' : (model.pageSize * model.page).toString(),
    };
    setSearchParams(newQueryOptions);
  };

  const processRowUpdate = useCallback((newRow: artist) => {
    setDirtyRows(prev => new Set(prev).add(newRow.artist_id));

    return newRow;
  }, []);

  const columns: GridColDef[] = [
    {
      field: 'artist_id',
      headerName: 'Artist ID',
      type: 'number',
      flex: 0.75,
      editable: false,
      cellClassName: 'artist-id',
      headerClassName: 'aritst-id--header',
    },
    {
      field: 'name',
      headerName: 'Name',
      type: 'string',
      editable: true,
      filterable: true,
      flex: 3,
      cellClassName: 'artist-name',
    },
    {
      field: 'update-delete',
      type: 'actions',
      headerName: 'Update / Delete',
      flex: 1.5,

      getActions: ({ row }: GridRowParams) => {
        const isDirty = dirtyRows.has(row.artist_id);
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon color={!isDirty ? 'disabled' : 'success'} />}
            title='Update'
            id='update-button'
            disabled={!isDirty}
            onClick={() => handleUpdateArtistName(row, fetcher)}
          />,
          <GridActionsCellItem
            label='Delete'
            title='Delete'
            id='delete-button'
            icon={<DeleteForeverIcon color='error' />}
            onClick={() => handleDeleteArtist(row, fetcher)}
          />,
        ];
      },
    },
    {
      field: 'details',
      type: 'actions',
      headerName: 'Albums',
      flex: 0.75,
      getActions: (params: GridRowParams) => {
        return [
          <GridActionsCellItem
            label='Albums'
            title='Albums'
            icon={<DetailsIcon color='info' />}
            onClick={() =>
              nav(
                `${params.row.artist_id}/albums?take=${queryOptions.take}&skip=${queryOptions.skip}&cursor=${queryOptions.cursor}`,
                { replace: true },
              )
            }
          />,
        ];
      },
    },
  ];

  const getID = (row: artist) => row.artist_id;

  return (
    <DataGrid
      apiRef={dgApiRef}
      logLevel='info'
      label='Artists'
      aria-label='artist-data-grid'
      columns={columns}
      rows={rows}
      getRowId={getID}
      rowCount={COUNT}
      getRowHeight={() => 'auto'}
      pageSizeOptions={[10, 25, 50, 100]}
      paginationMode='server'
      filterMode='server'
      sortingMode='server'
      onPaginationModelChange={handleChangePagination}
      paginationModel={model}
      processRowUpdate={processRowUpdate}
      onProcessRowUpdateError={error => console.error(error)}
      sx={{
        '&.MuiDataGrid-root': {
          backgroundColor: DATA_GRID_BG,
        },
        '& .MuiDataGrid-footerContainer': {
          backgroundColor: Theme.palette.background.paper,
          color: Theme.palette.text.secondary,
        },
        '& .MuiDataGrid-columnHeader': {
          backgroundColor: Theme.palette.background.paper,
          color: Theme.palette.text.secondary,
        },
        '.MuiDataGrid-columnSeparator': {
          color: Theme.palette.primary.dark,
        },
      }}
    />
  );
}

const handleUpdateArtistName = async (values: artist, fetcher: FetcherWithComponents<artist>) => {
  try {
    const { artist_id, name } = values;

    fetcher.submit(
      { artist_id, name, intent: 'update' },
      { method: 'PATCH', encType: 'application/json', action: '/portfolio/crud/artists' },
    );
  } catch (error) {
    console.error(error);
  }
};

const handleDeleteArtist = async (values: artist, fetcher: FetcherWithComponents<artist>) => {
  try {
    const { artist_id } = values;
    fetcher.submit(
      { artist_id, intent: 'delete' },
      { method: 'PATCH', encType: 'application/json', action: '/portfolio/crud/artists' },
    );
  } catch (err) {
    console.error(err);
  }
};
