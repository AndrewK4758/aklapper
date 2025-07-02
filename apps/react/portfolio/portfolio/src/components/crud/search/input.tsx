import type { album, artist } from '@aklapper/chinook-client';
import TextField from '@mui/material/TextField';
import { debounce } from '@mui/material/utils';
import axios from 'axios';
import type { ChangeEvent } from 'react';

export type SearchValues = {
  artist: artist[];
  album: album[];
};

interface SearchInputProps {
  setSearchValues: (searchResult: SearchValues) => void;
  searchTarget: string;
}

export default function SearchInput({ searchTarget, setSearchValues }: SearchInputProps) {
  return (
    <TextField
      id='search'
      autoFocus
      component={'search'}
      label={'Search'}
      variant='outlined'
      type='text'
      name='artist-search'
      onChange={debounce(e => handleSearchParams(e, setSearchValues, searchTarget), 560)}
      sx={{ width: '100%' }}
    />
  );
}

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
  setArtVals: (searchVals: SearchValues) => void,
  searchParam: string,
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
 * @returns {Promise<SearchValues>} A promise that resolves with the search results.
 */

const searchArtistsAndAlbums = async (search: string, type: string): Promise<SearchValues> => {
  try {
    const resp = await axios.get(`${baseURL}/search?search=${search}&type=${type}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    return resp.data as SearchValues;
  } catch (error) {
    console.error(error);
    return { artist: [], album: [] } as SearchValues;
  }
};
