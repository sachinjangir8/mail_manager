import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface AuthResponse {
  success: boolean;
  token?: string;
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
  } = useQuery<AuthResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<AuthResponse>("/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const handleAuthSuccess = (res: AuthResponse) => {
    if (res.token) {
      localStorage.setItem("reachinbox_token", res.token);
    }
    queryClient.setQueryData(["auth", "me"], { success: true, user: res.user });
    window.location.href = "/";
  };

  const loginMutation = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: handleAuthSuccess,
  });

  const signupMutation = useMutation({
    mutationFn: (body: { email: string; password: string; name?: string }) =>
      apiFetch<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: handleAuthSuccess,
  });

  const devLoginMutation = useMutation({
    mutationFn: (body: { email?: string; name?: string }) =>
      apiFetch<AuthResponse>("/auth/dev-login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: handleAuthSuccess,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      localStorage.removeItem("reachinbox_token");
      queryClient.setQueryData(["auth", "me"], null);
      window.location.href = "/login";
    },
  });

  return {
    user: data?.user || null,
    isAuthenticated: !!data?.user,
    isLoading,
    isError,
    error,
    refetch,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    signup: signupMutation.mutateAsync,
    isSigningUp: signupMutation.isPending,
    signupError: signupMutation.error,
    devLogin: devLoginMutation.mutate,
    isDevLoggingIn: devLoginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
