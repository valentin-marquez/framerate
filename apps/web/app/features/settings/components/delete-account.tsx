import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "~/shared/components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/shared/components/primitives/dialog";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { useTranslation } from "~/shared/hooks/use-translation";
import { ApiError, api } from "~/shared/lib/api";
import { SettingsSection } from "./settings-parts";

/** Borrar la cuenta: hay que escribir el propio handle. La API puede negarse (único dueño de una tienda, último admin). */
export function DeleteAccount({ username }: { username: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    setError(null);
    try {
      await api.delete("/v1/me", { body: JSON.stringify({ confirm }) });
      // Recarga completa: la sesión ya no existe y no debe quedar nada de la cuenta en memoria.
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("delete_account_error"));
      setPending(false);
    }
  };

  return (
    <SettingsSection title={t("delete_account")} description={t("delete_account_desc")}>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setConfirm("");
            setError(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="destructive" size="lg">
            {t("delete_account_button")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>{t("delete_account_confirm_title")}</DialogTitle>
            <DialogDescription>{t("delete_account_confirm_desc")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="confirm-username" className="text-card-foreground/65">
              {t("delete_account_type", { username })}
            </Label>
            <Input
              id="confirm-username"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              placeholder={username}
            />
          </div>
          {error && <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="link" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || confirm !== username}
              onClick={handleDelete}
            >
              {pending && <IconLoader2 className="size-4 animate-spin" />}
              {t("delete_account_button")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
