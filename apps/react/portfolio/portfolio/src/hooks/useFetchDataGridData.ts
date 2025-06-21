import { useEffect, useState } from 'react';
import type { PaginationModel } from '../components/crud/artists/data_grid';
import type { QueryOptions } from '../types/types';

type FetchDataResult<T> = {
  state: T | null;
  isLoading: boolean;
  refetchData: () => void;
};

const useFetchDataGridData = <T>(
  paginationModel: PaginationModel,
  loadData: (queryOptions: QueryOptions, signal: AbortSignal) => Promise<T | null>,
): FetchDataResult<T> => {
  const [state, setState] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { signal } = new AbortController();

  const queryOptions: QueryOptions = {
    cursor: paginationModel.page === 0 ? 1 : paginationModel.pageSize * paginationModel.page,
    pageSize: paginationModel.pageSize,
    skip: paginationModel.page === 0 ? 0 : 1,
  };

  console.log(paginationModel);
  const fetchData = async () => {
    try {
      const data = await loadData(queryOptions, signal);
      setState(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [paginationModel]);

  return { state, isLoading, refetchData: fetchData };
};

export default useFetchDataGridData;
