import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/shared/components/primitives/button";
import { ApiError } from "~/shared/lib/api";
import { type StoreMember, storesService } from "../services/stores";

interface StoreMemberListProps {
  slug: string;
  members: StoreMember[];
  currentUserIsOwner: boolean;
  token: string;
  onChange?: () => void;
}

export function StoreMemberList({ slug, members, currentUserIsOwner, token, onChange }: StoreMemberListProps) {
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(userId: string) {
    setRemoving(userId);
    try {
      await storesService.removeMember(slug, userId, token);
      toast.success("Miembro removido");
      onChange?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Error");
    } finally {
      setRemoving(null);
    }
  }

  if (members.length === 0) {
    return <p className="text-muted-foreground text-sm">No hay miembros todavía.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {members.map((m) => (
        <li key={m.userId} className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt="" className="size-8 rounded-full" />
            ) : (
              <div className="size-8 rounded-full bg-secondary" />
            )}
            <div>
              <div className="font-medium text-sm">{m.displayName}</div>
              <div className="text-muted-foreground text-xs">{m.role}</div>
            </div>
          </div>
          {currentUserIsOwner && m.role !== "owner" && (
            <Button variant="ghost" size="icon-sm" onClick={() => remove(m.userId)} disabled={removing === m.userId}>
              <IconTrash className="size-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
