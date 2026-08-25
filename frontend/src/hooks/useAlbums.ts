import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAlbum, fetchAlbums } from "../lib/mockApi";
import type { Album } from "../models/photo";

export const albumQueryKey = ["albums"] as const;

export function useAlbums() {
  return useQuery({
    queryKey: albumQueryKey,
    queryFn: fetchAlbums,
    staleTime: 5 * 60_000,
  });
}

export function useCreateAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAlbum,
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: albumQueryKey });
      const previous = queryClient.getQueryData<Album[]>(albumQueryKey);
      const optimistic: Album = {
        id: `temp-${Date.now()}`,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        photoIds: [],
      };
      queryClient.setQueryData<Album[]>(albumQueryKey, (current) => [optimistic, ...(current ?? [])]);
      return { previous };
    },
    onError: (_error, _name, context) => {
      if (context?.previous) queryClient.setQueryData(albumQueryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: albumQueryKey });
    },
  });
}
