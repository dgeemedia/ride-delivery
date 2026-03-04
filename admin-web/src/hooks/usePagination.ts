import { useState, useCallback } from 'react';

interface UsePaginationProps {
  initialPage?: number;
  initialLimit?: number;
}

export const usePagination = ({ 
  initialPage = 1, 
  initialLimit = 20 
}: UsePaginationProps = {}) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / limit);

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(page + 1);
  }, [page, goToPage]);

  const previousPage = useCallback(() => {
    goToPage(page - 1);
  }, [page, goToPage]);

  const reset = useCallback(() => {
    setPage(initialPage);
  }, [initialPage]);

  return {
    page,
    limit,
    total,
    totalPages,
    setPage,
    setLimit,
    setTotal,
    goToPage,
    nextPage,
    previousPage,
    reset,
  };
};