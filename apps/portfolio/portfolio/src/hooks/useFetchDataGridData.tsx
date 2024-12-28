import { useEffect, useMemo, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { PaginationModel, QueryOptions } from '../pages/crud/crud';
// import loadArtists from '../services/loaders/crud-loaders/load-artists';

const useFetchDataGridData = <T,>(
  paginationModel: PaginationModel,
  setState: Dispatch<SetStateAction<T | undefined>>,
  loadData: (queryOptions: QueryOptions) => Promise<T>
): void => {
  const queryOptions: QueryOptions = useMemo(
    () => ({
      cursor: paginationModel.page === 0 ? 1 : paginationModel.pageSize * paginationModel.page,
      pageSize: paginationModel.pageSize,
      skip: paginationModel.page === 0 ? 0 : 1
    }),
    [paginationModel]
  );

  const fetchData = useCallback(async (queryOptions: QueryOptions) => await loadData(queryOptions), [loadData]);

  useEffect(() => {
    fetchData(queryOptions)
      .then(state => setState(state))
      .catch(err => console.error(err));
  }, [fetchData, queryOptions, setState]);
};

export default useFetchDataGridData;
