import { render } from '@testing-library/react';
import Text from '../src/lib/text/text.jsx';

describe('Test Text', () => {
  it('Should Pass', () => {
    const baseComponent = render(
      <Text component={'h1'} variant={'h1'} children={'TEXT TITLE'} id='TEXT TITLE' sx={{ color: 'red' }} />,
    );

    expect(baseComponent.getByText('TEXT TITLE')).toBeTruthy();
  });
});
