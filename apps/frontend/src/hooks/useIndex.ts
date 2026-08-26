import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchIndexStatus, startIndex } from '../lib/api';
import {
  canRetryIndex,
  isIndexReady,
  shouldAutoStart,
  shouldInvalidatePhotos,
  shouldPoll,
  type IndexStatus,
} from '../lib/indexStatus';
import { photoQueryKey } from './usePhotos';

export const indexQueryKey = ['index', 'status'] as const;

export function useIndex() {
  const queryClient = useQueryClient();
  const prevRef = useRef<IndexStatus | undefined>(undefined);
  const autoStarted = useRef(false);

  const statusQuery = useQuery({
    queryKey: indexQueryKey,
    queryFn: fetchIndexStatus,
    refetchInterval: (query) => (query.state.data && shouldPoll(query.state.data) ? 750 : false),
  });

  const startMutation = useMutation({
    mutationFn: startIndex,
    onSuccess: (next) => {
      queryClient.setQueryData(indexQueryKey, next);
    },
  });

  const status = statusQuery.data;

  useEffect(() => {
    if (!status || startMutation.isPending) return;
    if (shouldPoll(status)) return;
    if (shouldAutoStart(status)) {
      if (autoStarted.current || startMutation.isError) return;
      autoStarted.current = true;
      startMutation.mutate();
      return;
    }
    // Allow a later not_started (library grew / missing originals) to auto-start again.
    autoStarted.current = false;
  }, [startMutation, status]);

  useEffect(() => {
    if (!status) return;
    if (shouldInvalidatePhotos(prevRef.current, status)) {
      void queryClient.invalidateQueries({ queryKey: photoQueryKey });
    }
    prevRef.current = status;
  }, [queryClient, status]);

  const retry = () => {
    if (statusQuery.isError && !status) {
      void statusQuery.refetch();
      return;
    }
    startMutation.reset();
    startMutation.mutate();
  };

  const rescan = () => {
    startMutation.reset();
    startMutation.mutate();
  };

  return {
    status,
    isLoading: statusQuery.isLoading && !status,
    isError: (statusQuery.isError && !status) || startMutation.isError,
    error: startMutation.error ?? statusQuery.error,
    isReadyForPhotos: !!status && isIndexReady(status),
    canRetry:
      (!!status && canRetryIndex(status)) ||
      startMutation.isError ||
      (statusQuery.isError && !status),
    retry,
    rescan,
    retrying: startMutation.isPending,
    rescanning: startMutation.isPending,
    refetch: statusQuery.refetch,
  };
}
