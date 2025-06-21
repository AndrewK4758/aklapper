import type { track } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import UploadIcon from '@mui/icons-material/Upload';
import { useGridApiRef } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid/components/cell';
import { DataGrid } from '@mui/x-data-grid/DataGrid';
import type { GridColDef } from '@mui/x-data-grid/models/colDef';
import type { GridRowParams } from '@mui/x-data-grid/models/params';
import { useState } from 'react';
import { useLoaderData } from 'react-router';
import handleDeleteTrack from '../../../services/events/crud-events/handle-delete-track';
import handleUpdateTrack from '../../../services/events/crud-events/handle-update-track';
import type { AlbumTracks } from '../../../services/loaders/crud-loaders/load-album-tracks';
import type { PaginationModel } from '../artists/data_grid';

const paginationModelInit: PaginationModel = {
  pageSize: 5,
  page: 0,
};

export default function TracksDataGrid() {
  const { tracks } = useLoaderData() as AlbumTracks;

  const [paginationModel, setPaginationModel] = useState<PaginationModel>(paginationModelInit);

  const apiRef = useGridApiRef();

  const columns: GridColDef[] = [
    {
      field: 'track_id',
      headerName: 'Track ID',
      type: 'number',
      flex: 1,
      cellClassName: 'track-id',
    },
    {
      field: 'name',
      headerName: 'Name',
      type: 'string',
      editable: true,
      flex: 3,
      cellClassName: 'track-name',
    },
    {
      field: 'unit_price',
      type: 'number',
      headerName: 'Unit Price',
      editable: true,
      flex: 1,
      cellClassName: 'unit-price',
    },
    {
      field: 'genre_id',
      type: 'number',
      headerName: 'Genre ID',
      editable: true,
      flex: 1,
      cellClassName: 'genre-id',
    },
    {
      field: 'media_type_id',
      type: 'number',
      headerName: 'Media Type ID',
      editable: true,
      flex: 1,
      cellClassName: 'media-type-id',
    },
    {
      field: 'composer',
      type: 'string',
      headerName: 'Composer',
      editable: true,
      flex: 2,
      cellClassName: 'composer',
    },
    {
      field: 'milliseconds',
      type: 'number',
      headerName: 'Milliseconds',
      editable: true,
      flex: 1,
      cellClassName: 'milliseconds',
    },
    {
      field: 'bytes',
      type: 'number',
      headerName: 'Bytes',
      editable: true,
      flex: 1,
      cellClassName: 'bytes',
    },

    {
      field: 'update-delete',
      type: 'actions',
      headerName: 'Actions',
      flex: 1.5,
      getActions: (params: GridRowParams<track>) => {
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon color='success' />}
            title='Update'
            onClick={() => {
              handleUpdateTrack(params.row, apiRef);
            }}
          />,

          <GridActionsCellItem
            label='Delete'
            title='Delete'
            icon={<DeleteForeverIcon color='error' />}
            onClick={() => {
              handleDeleteTrack(params.row, apiRef);
            }}
          />,
        ];
      },
    },
  ];

  const getID = (row: track) => row.track_id;

  return (
    <DataGrid
      aria-label='track-data-grid'
      apiRef={apiRef}
      columns={columns}
      rows={tracks}
      getRowId={getID}
      getRowHeight={() => 'auto'}
      pageSizeOptions={[1, 5, 10, 25]}
      paginationModel={paginationModel}
      onPaginationModelChange={newPageModel => setPaginationModel(newPageModel)}
    />
  );
}
