import Button from '@mui/material/Button';
import { useState, type ReactElement } from 'react';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import StyledCard from '../../styled/styled_card';
import type { SearchValues } from './input';
import SearchInput from './input';
import SearchRadioButtons from './radio_buttons.js';
import SearchResults from './results.js';

const initVals: SearchValues = {
  artist: [],
  album: [],
};

interface SearchProps {
  setOpen: (isOpen: boolean) => void;
}

/**
 * This component renders a search modal for the CRUD section.
 * It allows users to search for artists or albums in the database.
 * The search is automatic when user pauses typing for .6 secords.
 *
 * @param {SearchProps} props - The props for the Search component.
 * @param {boolean} props.open - Whether the search modal is open.
 * @returns {ReactElement} The rendered search modal component.
 */

const Search = ({ setOpen }: SearchProps): ReactElement => {
  const [searchValues, setSearchValues] = useState<SearchValues>(initVals);
  const [searchTarget, setSearchTarget] = useState<keyof SearchValues>('artist');

  const handleRadioButtonSelect = (searchValue: keyof SearchValues) => {
    setSearchTarget(searchValue);
  };

  const handleSetSearchValues = (searchResult: SearchValues) => {
    setSearchValues(searchResult);
  };

  return (
    <>
      <CenteredFlexDiv id='search-box-wrapper' sx={{ width: '100%' }}>
        <StyledCard
          component={'section'}
          sx={{ width: '85%', display: 'flex', alignItems: 'center', padding: 0, gap: 1 }}
        >
          <SearchRadioButtons searchTarget={searchTarget} handleRadioButtonSelect={handleRadioButtonSelect} />
          <SearchInput searchTarget={searchTarget} setSearchValues={handleSetSearchValues} />

          <Button id={'crud-search-close-button'} onClick={() => setOpen(false)} sx={{ marginRight: 1.5 }}>
            Close
          </Button>
        </StyledCard>
      </CenteredFlexDiv>
      {searchValues[searchTarget].length ? (
        <SearchResults searchResults={searchValues} searchTarget={searchTarget} />
      ) : null}
    </>
  );
};

export default Search;
