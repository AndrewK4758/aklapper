import { Label } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import { debounce } from '@mui/material/utils';
import { album, artist } from '@prisma/client';
import axios from 'axios';
import { useState, type ChangeEvent, type Dispatch, type JSX, type SetStateAction } from 'react';
import {
  crudSearchCloseButtonBoxSxProps,
  searchBoxCardSxProps,
  searchBoxResultsWrapperSxProps
} from '../../styles/crud-styles';
import { flexColumnStyles, pagesTitlesBoxStyles } from '../../styles/pages-styles';

type SearchValues = {
  artist: Partial<artist>[];
  album: Partial<album[]>;
};

const initVals: SearchValues = {
  artist: [],
  album: []
};

interface SearchProps {
  setOpen: Dispatch<SetStateAction<boolean>>;
}

/**
 * This component renders a search modal for the CRUD section.
 * It allows users to search for artists or albums in the database.
 * The search is automatic when user pauses typing for .6 secords.
 *
 * @param {SearchProps} props - The props for the Search component.
 * @param {boolean} props.open - Whether the search modal is open.
 * @returns {JSX.Element} The rendered search modal component.
 */

const Search = ({ setOpen }: SearchProps): JSX.Element => {
  const [artAlbVals, setArtVals] = useState<SearchValues>(initVals);
  const [searchParam, setSearchParam] = useState<string>('artist');

  return (
    <Box
      component={'div'}
      key={'search-box-wrapper'}
      id="search-box-wrapper"
      sx={{ ...flexColumnStyles, alignItems: 'center', width: '95%', gap: 1 }}
    >
      <Card elevation={2} component={'section'} key={'search-box-container'} sx={searchBoxCardSxProps}>
        <Container
          key={'search-box-container'}
          id="search-box-container"
          maxWidth={false}
          sx={{
            flex: '1 0 100%',
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            padding: 0,
            gap: 1
          }}
        >
          <Box component={'div'} key={'search-radio-group-box'} flex={1}>
            <RadioGroup
              defaultValue={'artist'}
              name="artist-album-select"
              sx={{
                ...pagesTitlesBoxStyles,
                height: '100%',
                flexDirection: 'column'
              }}
            >
              <FormControlLabel
                value={'artist'}
                label="Artist"
                control={<Radio value={'artist'} onChange={e => setSearchParam(e.target.value)} />}
              />
              <FormControlLabel
                value={'album'}
                label="Album"
                control={<Radio value={'album'} onChange={e => setSearchParam(e.target.value)} />}
              />
            </RadioGroup>
          </Box>

          <Box component={'div'} key={'search-input-box'} sx={{ flex: 5 }}>
            <TextField
              component={'search'}
              label={
                <Label
                  tooltipTitle={
                    'Search for artist or album. Search is automatic and debounced after .56 second of no typing'
                  }
                  labelVariant={'body1'}
                  labelText={'Search'}
                  placement={'top'}
                />
              }
              variant="standard"
              type="text"
              name="artist-search"
              onChange={debounce(e => handleSearchParams(e, setArtVals, searchParam), 560)}
              sx={{ width: '100%' }}
            />
          </Box>
          <Box
            key={'crud-search-close-button-box'}
            id={'crud-search-close-button-box'}
            sx={crudSearchCloseButtonBoxSxProps}
          >
            <Button
              key={'crud-search-close-button'}
              id={'crud-search-close-button'}
              color="primary"
              onClick={() => setOpen(false)}
              sx={{ fontSize: '1rem' }}
            >
              Close
            </Button>
          </Box>
        </Container>
      </Card>
      <List component={'ul'} key={'search-results'} id="search-results" sx={{ width: '100%' }}>
        <Card key={'search-reults-card'} id={'search-reults-card'}>
          {artAlbVals.artist.length > 0 ? (
            <Box
              key={'artist-search-results-wrapper'}
              id={'artist-search-results-wrapper'}
              sx={searchBoxResultsWrapperSxProps}
            >
              {artAlbVals.artist.map(e => (
                <Box component={'div'} key={`${e.artist_id}-box`} id={`${e.artist_id}-box`} width={'fit-content'}>
                  <ListItem component={'li'} key={e.name} sx={{ fontWeight: 'bold' }}>
                    {e.name}
                  </ListItem>
                </Box>
              ))}
            </Box>
          ) : null}
          {artAlbVals.album.length > 0 ? (
            <Box
              key={'album-search-results-wrapper'}
              id={'album-search-results-wrapper'}
              sx={searchBoxResultsWrapperSxProps}
            >
              {artAlbVals.album.map(e => (
                <Box
                  component={'div'}
                  key={`${(e as album).album_id}-box`}
                  id={`${(e as album).album_id}-box`}
                  width={'fit-content'}
                >
                  <ListItem component={'li'} key={(e as album).title} sx={{ fontWeight: 'bold' }}>
                    {(e as album).title}
                  </ListItem>
                </Box>
              ))}
            </Box>
          ) : null}
        </Card>
      </List>
    </Box>
  );
};

export default Search;

type SearchReturnType = {
  artist: artist[];
  album: album[];
};

/**
 * This function handles the search input change event.
 * It debounces the input change, fetches search results from the server, and updates the search results state.
 *
 * @param {ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} e - The change event object.
 * @param {Dispatch<SetStateAction<SearchValues>>} setArtVals - A function to update the search results state.
 * @param {string} searchParam - The type of search to perform ('artist' or 'album').
 */

const handleSearchParams = async (
  e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  setArtVals: Dispatch<SetStateAction<SearchValues>>,
  searchParam: string
) => {
  const searchParams = e.target.value;

  if (searchParams.length > 0 && searchParams[searchParams.length - 1] !== ' ') {
    const resp = await searchArtistsAndAlbums(searchParams, searchParam);

    if (resp) {
      const { artist, album } = resp;
      setArtVals({ artist: artist, album: album });
    }
  }
};

const baseURL = import.meta.env.VITE_CRUD_API_URL;

/**
 * This function fetches search results from the server based on the search query and type.
 *
 * @param {string} search - The search query.
 * @param {artist | album} type - The type of search to perform ('artist' or 'album').
 * @returns {Promise<SearchReturnType>} A promise that resolves with the search results.
 */

const searchArtistsAndAlbums = async (search: string, type: string): Promise<SearchReturnType> => {
  try {
    const resp = await axios.get(`${baseURL}/search?search=${search}&type=${type}`, {
      headers: { 'Content-Type': 'text/plain' }
    });

    return resp.data as SearchReturnType;
  } catch (error) {
    console.error(error);
    return { artist: [], album: [] } as SearchReturnType;
  }
};
