import { render } from '@testing-library/react';

import ConnectIcon from '../src/components/header/connect-icon/connect-icon';

describe('ConnectIcon', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ConnectIcon />);
    expect(baseElement).toBeTruthy();
  });
});
