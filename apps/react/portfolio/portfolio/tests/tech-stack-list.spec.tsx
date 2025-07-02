import '@testing-library/jest-dom';
import { act, render, type RenderResult } from '@testing-library/react';
import {
  analytics,
  build,
  cloud,
  data,
  languages,
  libraries,
  styles,
  testing,
} from '../src/components/intro/static/tech-stack-text';
import TechStackList from '../src/components/intro/tech-list/tech-stack-lists.js';

let baseComponent: RenderResult;

describe('Test the TechStackList component', () => {
  beforeEach(async () => {
    act(() => {
      baseComponent = render(<TechStackList />);
    });

    act(() => {
      const openButton = baseComponent.getByTestId('tech-list-title-text-button');
      openButton.click();
    });
  });

  it('should render tech stack lists correctly', () => {
    const allItems = [languages, libraries, styles, data, cloud, build, analytics, testing];
    allItems.forEach((list: string[]) => {
      list.forEach(async (e: string) => {
        const item = baseComponent.getByText(e);
        const itemSvg = baseComponent.getByTestId(`${e}-svg-icon`);

        expect(item).toBeInTheDocument();
        expect(itemSvg).toBeInTheDocument();
      });
    });
  });
});
