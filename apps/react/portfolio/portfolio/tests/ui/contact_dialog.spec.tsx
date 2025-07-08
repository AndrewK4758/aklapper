import '@testing-library/jest-dom';

import ContactDialog from '../../src/components/contact/contact_dialog';
import { render, ROUTES, screen } from '../utils/render_react_rotuter';

let isOpen: boolean, handleIsOpen: () => void;

describe('test contact dialog', () => {
  it('should  not be in document', async () => {
    isOpen = false;

    handleIsOpen = () => {
      isOpen = true;
    };

    render(
      <body>
        <ContactDialog isOpen={isOpen} handleIsOpen={handleIsOpen} />
      </body>,
      {
        path: ROUTES.PORTFOLIO,
        initialRoute: ROUTES.PORTFOLIO,
      },
    );

    const contactClosed = screen.queryByTestId('contact-dialog');

    expect(contactClosed).not.toBeInTheDocument();
  });

  it('should be in document', async () => {
    isOpen = true;

    handleIsOpen = () => {
      isOpen = false;
    };

    render(
      <body>
        <ContactDialog isOpen={isOpen} handleIsOpen={handleIsOpen} />
      </body>,
      {
        path: ROUTES.PORTFOLIO,
        initialRoute: ROUTES.PORTFOLIO,
      },
    );

    const element = await screen.findByTestId('contact-dialog');

    expect(element).toBeInTheDocument();
  });

  it('should have appointment tab selected', async () => {
    const tab1 = 'appointment-request-tab';
    const tab2 = 'email-me-tab';

    isOpen = true;

    handleIsOpen = () => {
      isOpen = false;
    };

    render(
      <body>
        <ContactDialog isOpen={isOpen} handleIsOpen={handleIsOpen} />
      </body>,
      {
        path: ROUTES.PORTFOLIO,
        initialRoute: ROUTES.PORTFOLIO,
      },
    );

    const selectedTab = await screen.findByTestId(tab1);
    const unselectedTab = await screen.findByTestId(tab2);

    expect(selectedTab).toHaveAttribute('aria-selected', 'true');
    expect(unselectedTab).toHaveAttribute('aria-selected', 'false');
  });
});
