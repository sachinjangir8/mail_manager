import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface MeResponse {
  success: boolean;
  user: User;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<MeResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<MeResponse>("/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      window.location.href = "/login";
    },
  });

  const devLoginMutation = useMutation({
    mutationFn: (body: { email?: string; name?: string }) =>
      apiFetch<MeResponse>("/auth/dev-login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      window.location.href = "/";
    },
  });

  return {
    user: data?.user || null,
    isAuthenticated: !!data?.user,
    isLoading,
    isError,
    error,
    refetch,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    devLogin: devLoginMutation.mutate,
    isDevLoggingIn: devLoginMutation.isPending,
  };
}
