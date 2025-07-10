import { LargeStyledDialog } from '@aklapper/react-shared';
import { type ReactElement } from 'react';
import { useLocation } from 'react-router';
import AddEntryForm from './form';
import AddEntryHeader from './header';

/**
 * This component renders a modal for adding new entries to the database.
 * It allows users to add new artists, albums, and tracks through a step-by-step process.
 *
 * @returns {ReactElement} The rendered add entry modal component.
 */

const AddEntry = (): ReactElement => {
  const { pathname } = useLocation();

  return (
    <LargeStyledDialog id='add-entry-modal-wrapper' open={pathname === '/portfolio/crud/add-entry'}>
      <AddEntryHeader />
      <AddEntryForm />
    </LargeStyledDialog>
  );
};

export default AddEntry;
