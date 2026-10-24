import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Trash2, Wand2 } from "lucide-react";
import React from "react";
import { apiFetch } from "../../lib/api";

export interface Sender {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  isEthereal: boolean;
  enabled: boolean;
}

export const SendersView: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ success: boolean; senders: Sender[] }>({
    queryKey: ["senders"],
    queryFn: () => apiFetch("/senders"),
  });

  const createSenderMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch("/senders", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["senders"] });
    },
  });

  const deleteSenderMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/senders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["senders"] });
    },
  });

  const handleAutoCreateEthereal = () => {
    createSenderMutation.mutate({
      autoGenerateEthereal: true,
      displayName: `Ethereal Sender ${Date.now().toString().slice(-4)}`,
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Email Senders</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your authenticated email senders and Ethereal SMTP accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-auto-create-ethereal"
            onClick={handleAutoCreateEthereal}
            disabled={createSenderMutation.isPending}
            className="flex items-center gap-2 px-3.5 py-2 border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-xl transition"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Auto-generate Ethereal Sender
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading senders...</div>
        ) : !data?.senders?.length ? (
          <div className="p-12 text-center">
            <Mail className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-gray-800">No Senders Configured</h4>
            <p className="text-xs text-gray-500 mt-1">
              Click &quot;Auto-generate Ethereal Sender&quot; above to create a test sender instantly.
            </p>
          </div>
        ) : (
          data.senders.map((sender) => (
            <div key={sender.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm">
                  {sender.displayName?.[0] || "S"}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {sender.displayName}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {sender.email} • {sender.smtpHost}:{sender.smtpPort}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                  Active
                </span>
                <button
                  onClick={() => deleteSenderMutation.mutate(sender.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition"
                  title="Delete sender"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
