import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPhotos, toggleFavorite } from "../lib/mockApi";
import type { Photo } from "../models/photo";

export const photoQueryKey = ["photos"] as const;

export function usePhotos() {
  return useQuery({
    queryKey: photoQueryKey,
    queryFn: fetchPhotos,
    staleTime: 5 * 60_000,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleFavorite,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: photoQueryKey });
      const previous = queryClient.getQueryData<Photo[]>(photoQueryKey);
      queryClient.setQueryData<Photo[]>(photoQueryKey, (current) =>
        current?.map((photo) => (photo.id === id ? { ...photo, favorite: !photo.favorite } : photo)),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(photoQueryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: photoQueryKey });
    },
  });
}
