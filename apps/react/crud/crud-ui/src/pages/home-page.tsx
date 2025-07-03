import type { album, artist } from '@aklapper/chinook-client';
import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import { debounce } from '@mui/material/utils';
import axios from 'axios';
import { type ChangeEvent, type Dispatch, type SetStateAction, useState } from 'react';
import { Outlet } from 'react-router';

type InitVals = {
  artist: Partial<artist>[];
  album: Partial<album[]>;
};
const initVals: InitVals = {
  artist: [],
  album: [],
};

const HomePage = () => {
  const [artAlbVals, setArtVals] = useState(initVals);
  const [searchParam, setSearchParam] = useState<string>('artist');

  return (
    <>
      <Box component={'div'} key={'grid-wrapper'} id='grid-wrapper' flex={'1 0 75%'}>
        <Grid
          container
          component={'div'}
          id='grid-container'
          columns={2}
          rowGap={1}
          rowSpacing={0}
          direction={'column'}
          wrap='nowrap'
        >
          <Grid component={'div'} id='title-grid' size={2}>
            <Container component={'div'} sx={{ paddingY: 1 }}>
              <Text
                id='home-page-title'
                variant='h1'
                children={'Media Data Manager'}
                sx={{ textAlign: 'center', fontSize: '4rem' }}
              />
              <Text variant='h5' children='Example of MUI-X DataGrid' sx={{ textAlign: 'center' }} />
              <Text
                variant='body1'
                children={
                  'Columns have sorting & filtering, cells can be updated and changes can be sent to the back end, rows can be deleted, each catagory has the ability to create an entry, ADD ENTRY provides the opportunity to add all fields at once'
                }
              />
            </Container>
          </Grid>
          <Grid component={'div'} id='data-grid-grids' size={2} width={'50%'}>
            <Outlet />
          </Grid>
        </Grid>
      </Box>
      <Box sx={{ height: 'fit-content', flex: '1 0 25%' }}>
        <Card
          elevation={2}
          component={'section'}
          key={'search-box-container'}
          sx={{ paddingY: 1, display: 'flex', justifyContent: 'center', marginTop: 1 }}
        >
          <Box component={'div'} key={'search-radio-group-box'}>
            <RadioGroup
              defaultValue={'artist'}
              name='artist-album-select'
              sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <FormControlLabel
                value={'artist'}
                label='Artist'
                control={<Radio value={'artist'} onChange={e => setSearchParam(e.target.value)} />}
                slotProps={{ typography: { sx: { fontSize: '1rem' } } }}
                sx={{ width: '100%', paddingLeft: 1 }}
              />
              <FormControlLabel
                value={'album'}
                label='Album'
                control={
                  <Radio
                    onChange={e => {
                      setSearchParam(e.target.value);
                    }}
                  />
                }
                slotProps={{ typography: { sx: { fontSize: '1 rem' } } }}
                sx={{ width: '100%', paddingLeft: 1 }}
              />
            </RadioGroup>
          </Box>

          <Box component={'div'} key={'search-input-box'} sx={{ paddingY: 1 }}>
            <TextField
              component={'search'}
              label='Search'
              variant='outlined'
              type='text'
              name='artist-search'
              helperText='Search is performed automatically. Case is insensitive'
              onChange={debounce(e => handleSearchParams(e, setArtVals, searchParam), 500)}
            />
          </Box>
        </Card>
        <Container>
          {artAlbVals.artist.length > 0 ? (
            <List component={'ul'}>
              {artAlbVals.artist.map(e => (
                <ListItem key={e.artist_id}>{e.name}</ListItem>
              ))}
            </List>
          ) : null}
          {artAlbVals.album.length > 0 ? (
            <List component={'ul'}>
              {artAlbVals.album.map(e => (
                <ListItem key={e?.album_id}>{e?.title}</ListItem>
              ))}
            </List>
          ) : null}
        </Container>
      </Box>
    </>
  );
};

export default HomePage;

const handleSearchParams = async (
  e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  setArtVals: Dispatch<SetStateAction<InitVals>>,
  searchParam: string,
) => {
  const searchParams = e.target.value;

  if (searchParams.length > 0 && searchParams[searchParams.length - 1] !== ' ') {
    const resp = await searchArtistsAndAlbums(searchParams, searchParam);

    if (resp) {
      const { artist, album } = resp.data;
      setArtVals({ artist: artist, album: album });
    }
  }
};

const baseURL = import.meta.env.VITE_DATA_API_URL;

const searchArtistsAndAlbums = async (search: string, type: string) => {
  try {
    const resp = await axios.get(`${baseURL}/search?search=${search}&type=${type}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    console.log(resp.data);
    return resp;
  } catch (error) {
    console.error(error);
    return null;
  }
};
