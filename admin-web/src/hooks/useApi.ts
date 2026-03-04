import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  successMessage?: string;
  errorMessage?: string;
}

export function useApi<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const execute = useCallback(
    async (
      apiFunction: () => Promise<T>,
      options: UseApiOptions<T> = {}
    ) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiFunction();
        setData(result);
        
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        
        if (options.onSuccess) {
          options.onSuccess(result);
        }
        
        return result;
      } catch (err: any) {
        setError(err);
        
        const errorMsg = options.errorMessage || 
          err.response?.data?.message || 
          'An error occurred';
        
        toast.error(errorMsg);
        
        if (options.onError) {
          options.onError(err);
        }
        
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, loading, error, execute };
}