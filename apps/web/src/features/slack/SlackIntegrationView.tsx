import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, RefreshCw, Slack } from "lucide-react";
import React from "react";
import { apiFetch } from "../../lib/api";

interface SlackStatus {
  connected: boolean;
  workspaceName?: string | null;
  channelId?: string | null;
  channelName?: string | null;
  connectedAt?: string | null;
}

export const SlackIntegrationView: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<{ success: boolean } & SlackStatus>({
    queryKey: ["slack", "status"],
    queryFn: () => apiFetch("/integrations/slack/status"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiFetch("/integrations/slack/disconnect", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slack", "status"] });
    },
  });

  const handleConnect = () => {
    window.location.href = "http://localhost:4000/api/integrations/slack/connect";
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Slack Integration</h2>
        <p className="text-sm text-gray-500 mt-1">
          Connect your team&apos;s Slack workspace to receive real-time alerts whenever a sender hits its hourly sending limit.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#4A154B]/10 text-[#4A154B] flex items-center justify-center">
              <Slack className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Slack Web API Alerts</h3>
              <p className="text-xs text-gray-500">
                Direct OAuth 2.0 connection with bot token storage and rate limit alert deduplication
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              title="Refresh status"
              className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin text-brand-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Integration Status Box */}
        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <span className="text-xs text-gray-400">Checking connection status...</span>
            ) : data?.connected ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                <span className="text-sm font-semibold text-gray-900">Connected</span>
                {data.workspaceName && (
                  <span className="text-xs text-gray-500">
                    to workspace <strong className="text-gray-800">{data.workspaceName}</strong>
                    {data.channelName ? ` in #${data.channelName}` : ""}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                <span className="text-sm font-semibold text-gray-500">Disconnected</span>
              </div>
            )}
          </div>

          <div>
            {data?.connected ? (
              <button
                id="btn-disconnect-slack"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold transition"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </button>
            ) : (
              <button
                id="btn-connect-slack"
                onClick={handleConnect}
                className="flex items-center gap-2 px-4 py-2 bg-[#4A154B] hover:bg-[#3B113C] text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Slack className="w-4 h-4" />
                Connect Slack
              </button>
            )}
          </div>
        </div>

        {/* Informative notification card */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Hourly Limit Alert Behavior
          </h4>
          <ul className="text-xs text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Instant Alert:</strong> As soon as a sender reaches its hourly limit, a message is immediately posted to Slack with the sender name, configured limit, hour window, and next eligible send time.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Deduplication:</strong> Repeated alerts for the same sender and same 1-hour window are strictly suppressed by database idempotency keys.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Fault-Tolerant:</strong> If Slack credentials are not yet configured or the network is interrupted, email jobs continue safely without being dropped.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
