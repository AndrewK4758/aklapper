import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { PaginationModel } from '../components/crud/artists/data_grid';
import type { QueryOptions } from '../types/types';

type FetchDataResult = {
  isLoading: boolean;
  refetchData: () => void;
};

const useFetchDataGridData = <T>(
  paginationModel: PaginationModel,
  loadData: (queryOptions: QueryOptions, signal: AbortSignal, ...args: string[]) => Promise<T>,
  setRows: Dispatch<SetStateAction<T>>,
  ...args: string[]
): FetchDataResult => {
  const [isLoading, setIsLoading] = useState(true);
  const firstRenderRef = useRef(true);

  const { signal } = new AbortController();

  const queryOptions: QueryOptions = {
    cursor: paginationModel.page === 0 ? 1 : paginationModel.pageSize * paginationModel.page,
    take: paginationModel.pageSize,
    skip: paginationModel.page === 0 ? 0 : 1,
  };

  const fetchData = async () => {
    try {
      const data = await loadData(queryOptions, signal, ...args);

      console.log(data);
      setRows(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    fetchData();
  }, [paginationModel, setRows]);

  return { isLoading, refetchData: fetchData };
};

export default useFetchDataGridData;
