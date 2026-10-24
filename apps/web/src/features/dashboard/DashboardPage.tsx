import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Header } from "../../components/layout/Header";
import { Sidebar } from "../../components/layout/Sidebar";
import { apiFetch } from "../../lib/api";
import { ComposeModal } from "../compose/ComposeModal";
import { SendersView } from "../senders/SendersView";
import { SlackIntegrationView } from "../slack/SlackIntegrationView";
import { EmailDetailModal } from "./EmailDetailModal";
import { ScheduledList } from "./ScheduledList";
import { SentList } from "./SentList";

export const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent" | "senders" | "slack">("scheduled");
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);

  // 1. Fetch Senders
  const { data: sendersData } = useQuery<{ success: boolean; senders: any[] }>({
    queryKey: ["senders"],
    queryFn: () => apiFetch("/senders"),
  });

  // 2. Fetch Scheduled Emails (or search if query provided)
  const {
    data: scheduledData,
    isLoading: scheduledLoading,
    refetch: refetchScheduled,
    isRefetching: isRefetchingScheduled,
  } = useQuery<{ success: boolean; items: any[]; total: number }>({
    queryKey: ["emails", "scheduled", searchQuery],
    queryFn: () => {
      if (searchQuery.trim().length > 0) {
        return apiFetch(`/emails/search?q=${encodeURIComponent(searchQuery)}&status=scheduled`);
      }
      return apiFetch("/emails/scheduled");
    },
  });

  // 3. Fetch Sent Emails (or search if query provided)
  const {
    data: sentData,
    isLoading: sentLoading,
    refetch: refetchSent,
    isRefetching: isRefetchingSent,
  } = useQuery<{ success: boolean; items: any[]; total: number }>({
    queryKey: ["emails", "sent", searchQuery],
    queryFn: () => {
      if (searchQuery.trim().length > 0) {
        return apiFetch(`/emails/search?q=${encodeURIComponent(searchQuery)}&status=sent`);
      }
      return apiFetch("/emails/sent");
    },
  });

  // 4. Schedule Email Mutation
  const scheduleMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch("/emails/schedule", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      setComposeOpen(false);
      alert(
        `Campaign scheduled successfully!\n• Total: ${data.totalScheduled} emails\n• Delay: ${data.delayBetweenSendsMs / 1000}s\n• Hourly limit: ${data.hourlyLimit}/hr`
      );
    },
    onError: (err: any) => {
      alert(`Scheduling failed: ${err.message}`);
    },
  });

  // 5. Cancel Email Mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/emails/campaigns/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });

  const handleRefresh = () => {
    refetchScheduled();
    refetchSent();
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden">
      {/* Left Sidebar matching Figma */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCompose={() => setComposeOpen(true)}
        scheduledCount={scheduledData?.total ?? 0}
        sentCount={sentData?.total ?? 0}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header with Search and Actions */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          isRefreshing={isRefetchingScheduled || isRefetchingSent}
        />

        {/* Content Router */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "scheduled" && (
            <ScheduledList
              items={scheduledData?.items || []}
              isLoading={scheduledLoading}
              onSelectEmail={setSelectedEmail}
              onCancelEmail={(id) => cancelMutation.mutate(id)}
            />
          )}

          {activeTab === "sent" && (
            <SentList
              items={sentData?.items || []}
              isLoading={sentLoading}
              onSelectEmail={setSelectedEmail}
            />
          )}

          {activeTab === "senders" && <SendersView />}

          {activeTab === "slack" && <SlackIntegrationView />}
        </main>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        senders={sendersData?.senders || []}
        onSubmitSchedule={scheduleMutation.mutateAsync}
        isSubmitting={scheduleMutation.isPending}
      />

      {/* Email Detail Modal */}
      <EmailDetailModal
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
        onCancel={(id) => cancelMutation.mutate(id)}
      />
    </div>
  );
};
