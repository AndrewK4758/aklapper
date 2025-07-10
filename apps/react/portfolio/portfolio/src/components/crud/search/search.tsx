import { CenteredFlexDiv, StyledCard } from '@aklapper/react-shared';
import { useState, type ReactElement } from 'react';
import type { SearchValues } from './input';
import SearchInput from './input';
import SearchRadioButtons from './radio_buttons';
import SearchResults from './results';

const initVals: SearchValues = {
  artist: [],
  album: [],
};

/**
 * This component renders a search modal for the CRUD section.
 * It allows users to search for artists or albums in the database.
 * The search is automatic when user pauses typing for .6 secords.
 *
 * @returns {ReactElement} The rendered search modal component.
 */

const Search = (): ReactElement => {
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
        </StyledCard>
      </CenteredFlexDiv>
      {searchValues[searchTarget].length ? (
        <SearchResults searchResults={searchValues} searchTarget={searchTarget} />
      ) : null}
    </>
  );
};

export default Search;
