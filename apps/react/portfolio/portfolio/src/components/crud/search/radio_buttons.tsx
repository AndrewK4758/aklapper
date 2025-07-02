import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import type { SearchValues } from './input';

interface SearchRadioButtonsProps {
  searchTarget: keyof SearchValues;
  handleRadioButtonSelect: (searchTarget: keyof SearchValues) => void;
}

export default function SearchRadioButtons({ searchTarget, handleRadioButtonSelect }: SearchRadioButtonsProps) {
  return (
    <RadioGroup value={searchTarget} name='artist-album-select' sx={{ p: 1 }}>
      <FormControlLabel
        value={'artist'}
        label='Artist'
        control={<Radio value={'artist'} onChange={e => handleRadioButtonSelect(e.target.value as 'artist')} />}
      />
      <FormControlLabel
        value={'album'}
        label='Album'
        control={<Radio value={'album'} onChange={e => handleRadioButtonSelect(e.target.value as 'album')} />}
      />
    </RadioGroup>
  );
}
