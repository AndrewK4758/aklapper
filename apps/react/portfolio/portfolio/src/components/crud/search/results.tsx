import type { album, artist } from '@aklapper/chinook-client';
import { RenderList } from '@aklapper/react-shared';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import type { SxProps } from '@mui/material/styles';
import Theme from '../../../styles/themes/theme';
import type { SearchValues } from './input';

const searchListSxProps: SxProps = {
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  flexWrap: 'wrap',
  overflowY: 'auto',
  maxHeight: '80vh',
  alignContent: 'flex-start',
  columnGap: Theme.spacing(4),
};

const listItemSxProps: SxProps = { fontWeight: 'bold', listStyle: 'none', p: 0.5, width: '25%' };

type SearchValuesTypes = artist | album;

interface SearchResultsProps {
  searchResults: SearchValues;
  searchTarget: keyof SearchValues;
}

export default function SearchResults({ searchResults, searchTarget }: SearchResultsProps) {
  const renderSearchResults = (e: SearchValuesTypes) => <SearchResult key={e.artist_id} result={e} />;

  return (
    <Card id={'search-reults-card'}>
      <List component={'ul'} key={'search-results'} id='search-results' sx={searchListSxProps}>
        {searchTarget && (
          <RenderList<SearchValuesTypes> data={searchResults[searchTarget]} listMapCallback={renderSearchResults} />
        )}
      </List>
    </Card>
  );
}

interface SearchResultProps {
  result: SearchValuesTypes;
}

function SearchResult({ result }: SearchResultProps) {
  const searchResult = 'name' in result ? result.name : result.title;

  return <ListItem sx={listItemSxProps}>{searchResult}</ListItem>;
}
