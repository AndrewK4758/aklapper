import '@testing-library/jest-dom';
import techStackText from '../../src/components/home/static/tech-stack-text';
import TechStackLists from '../../src/components/home/tech-list/tech-stack-lists';
import { render, ROUTES, screen } from '../utils/render_react_rotuter';

describe('test intro tech stack lists', () => {
  it('should pass and render the lists with icons', () => {
    render(<TechStackLists />, {
      initialRoute: ROUTES.PORTFOLIO,
      path: ROUTES.PORTFOLIO,
    });

    const techStackLists = screen.getByTestId('tech-stack-lists-grid');

    expect(techStackLists.childNodes.length).toEqual(techStackText.length);
  });
});
