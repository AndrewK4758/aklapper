import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Text from '../src/lib/text/text.js';

const TITLE_TEXT = 'H1 Header';
const TEST_ID = 'header';

describe('Test Text', () => {
  it('Should Pass', () => {
    render(<Text variant={'h1'} children={TITLE_TEXT} data-testid={TEST_ID} sx={{ color: 'red' }} />);

    const element = screen.getByTestId(TEST_ID);

    expect(element).toBeInTheDocument();
    expect(element.className.length).toBeGreaterThan(1);
  });
});
