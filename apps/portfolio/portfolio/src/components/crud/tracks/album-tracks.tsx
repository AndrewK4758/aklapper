import { Text } from '@aklapper/react-shared';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import UploadIcon from '@mui/icons-material/Upload';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { DataGrid, GridActionsCellItem, GridColDef, GridRowParams, useGridApiRef } from '@mui/x-data-grid';
import { track } from '@prisma/client';
import { useState, type JSX } from 'react';
import { useLoaderData, useParams } from 'react-router';
import { PaginationModel } from '../../../pages/crud/crud.jsx';
import handleDeleteTrack from '../../../services/events/crud-events/handle-delete-track.jsx';
import handleUpdateTrack from '../../../services/events/crud-events/handle-update-track.jsx';
import { AlbumTracks } from '../../../services/loaders/crud-loaders/load-album-tracks.jsx';
import { dataGridStyleUpdate } from '../../../styles/crud-styles.jsx';
import AddTrack from './add-track.jsx';

const paginationModelInit: PaginationModel = {
  pageSize: 5,
  page: 0
};

/**
 * This component renders a page displaying a list of tracks for a specific album.
 * It includes functionality for adding, updating, and deleting tracks.
 *
 * @returns {JSX.Element} The rendered Tracks component.
 */

const Tracks = (): JSX.Element => {
  const { tracks } = useLoaderData() as AlbumTracks;
  const params = useParams();
  const [paginationModel, setPaginationModel] = useState<PaginationModel>(paginationModelInit);

  const albumID = parseInt(params.albumID as string, 10);

  const apiRef = useGridApiRef();

  const columns: GridColDef[] = [
    {
      field: 'track_id',
      headerName: 'Track ID',
      type: 'number',
      flex: 1
    },
    {
      field: 'name',
      headerName: 'Name',
      type: 'string',
      editable: true,
      flex: 3
    },
    {
      field: 'unit_price',
      type: 'number',
      headerName: 'Unit Price',
      editable: true,
      flex: 1
    },
    {
      field: 'genre_id',
      type: 'number',
      headerName: 'Genre ID',
      editable: true,
      flex: 1
    },
    {
      field: 'media_type_id',
      type: 'number',
      headerName: 'Media Type ID',
      editable: true,
      flex: 1
    },
    {
      field: 'composer',
      type: 'string',
      headerName: 'Composer',
      editable: true,
      flex: 2
    },
    {
      field: 'milliseconds',
      type: 'number',
      headerName: 'Milliseconds',
      editable: true,
      flex: 1
    },
    {
      field: 'bytes',
      type: 'number',
      headerName: 'Bytes',
      editable: true,
      flex: 1
    },

    {
      field: 'update-delete',
      type: 'actions',
      headerName: 'Actions',
      flex: 1.5,
      getActions: (params: GridRowParams<track>) => {
        return [
          <GridActionsCellItem
            label="Update"
            icon={<UploadIcon />}
            title="Update"
            onClick={() => {
              handleUpdateTrack(params.row, apiRef);
            }}
          />,

          <GridActionsCellItem
            label="Delete"
            title="Delete"
            icon={<DeleteForeverIcon />}
            onClick={() => {
              handleDeleteTrack(params.row, apiRef);
            }}
          />
        ];
      }
    }
  ];

  const getID = (row: track) => row.track_id;

  return (
    <Paper component={'div'} key={'track-box'} id={'track-box'} sx={{ border: '3px solid purple', borderRadius: 1 }}>
      <Container key={'artist-title'} component={'div'} sx={{ paddingY: 2 }}>
        <Paper key={'title-bar'} component={'div'}>
          <Text component={'h3'} titleVariant="h3" titleText="Album Tracks" sx={{ textAlign: 'center' }} />
        </Paper>
      </Container>
      <Container component={'div'} key={'add-track-box'} sx={{ paddingY: 1 }}>
        <AddTrack albumID={albumID} apiRef={apiRef} />
      </Container>
      <Box component={'div'} key={'tracks-data-grid-wrapper'} id="tracks-data-grid-wrapper" sx={{ borderRadius: 1 }}>
        <DataGrid
          apiRef={apiRef}
          columns={columns}
          rows={tracks}
          getRowId={getID}
          getRowHeight={() => 'auto'}
          pageSizeOptions={[1, 5, 10, 25]}
          paginationModel={paginationModel}
          onPaginationModelChange={newPageModel => setPaginationModel(newPageModel)}
          sx={dataGridStyleUpdate}
        />
      </Box>
    </Paper>
  );
};

export default Tracks;
