import { GRIPS, type Hand, HandSchema, mmRangeParam, mouseFit } from "@framerate/contracts";
import { useEffect, useId, useState } from "react";
import { useUser } from "~/features/auth/hooks/useAuth";
import { useFilterParams } from "~/features/catalog/use-filter-params";
import { Button } from "~/shared/components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/shared/components/primitives/dialog";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { alreadyReported, dismissPrompt, storedHand, storeHand } from "../hand-storage";
import { mouseFitClient } from "../services/mouse-fit";
import { HandGuide } from "./hand-guide";
import { MouseFitReport } from "./mouse-fit-report";

const GRIP_LABELS: Record<Hand["grip"], string> = { palm: "Palma", claw: "Garra", fingertip: "Puntas" };

const typed = (value: string) => (value.trim() === "" ? Number.NaN : Number(value.replace(",", ".")));

export function MouseFitDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const user = useUser();
  const { update } = useFilterParams();
  const lengthId = useId();
  const widthId = useId();
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [grip, setGrip] = useState<Hand["grip"]>("palm");
  const [saved, setSaved] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fill = (hand: Hand | null) => {
      setSaved(hand !== null);
      if (!hand) return;
      setLength(String(hand.length_mm));
      setWidth(String(hand.width_mm));
      setGrip(hand.grip);
    };
    setReported(alreadyReported());
    if (user)
      mouseFitClient
        .getHand()
        .then((r) => fill(r.hand))
        .catch(() => {});
    else fill(storedHand());
  }, [open, user]);

  const parsed = HandSchema.safeParse({ length_mm: typed(length), width_mm: typed(width), grip });
  const hand = parsed.success ? parsed.data : null;
  const fit = hand && mouseFit(hand);
  const incomplete = length.trim() === "" || width.trim() === "";

  const save = (value: Hand) => {
    setSaved(true);
    if (user) mouseFitClient.saveHand(value).catch(() => {});
    else storeHand(value);
  };

  const showRange = () => {
    if (!hand || !fit) return;
    save(hand);
    dismissPrompt();
    update({ fit_length: mmRangeParam(fit.length), fit_width: mmRangeParam(fit.width) });
    onOpenChange(false);
  };

  const forget = () => {
    if (user) mouseFitClient.deleteHand().catch(() => {});
    else storeHand(null);
    setSaved(false);
    setLength("");
    setWidth("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-6">
          <DialogHeader className="text-center sm:text-left">
            <DialogTitle className="text-foreground text-title-h6">Mide tu mano</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Con una regla, con la mano abierta y los dedos juntos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <HandGuide />
            <div className="flex w-full flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={lengthId}>Largo (mm)</Label>
                  <Input
                    id={lengthId}
                    inputMode="decimal"
                    placeholder="190"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={widthId}>Ancho (mm)</Label>
                  <Input
                    id={widthId}
                    inputMode="decimal"
                    placeholder="95"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-sm">Tu agarre</span>
                <div className="grid grid-cols-3 gap-2">
                  {GRIPS.map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={grip === value ? "default" : "outline"}
                      aria-pressed={grip === value}
                      onClick={() => setGrip(value)}
                    >
                      {GRIP_LABELS[value]}
                    </Button>
                  ))}
                </div>
              </div>
              {!hand && !incomplete && (
                <p role="alert" className="text-destructive text-sm">
                  Revisa las medidas: van en milímetros, por ejemplo 190 de largo y 95 de ancho.
                </p>
              )}
            </div>
          </div>

          {fit && hand && (
            <div className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-4 text-center sm:text-left">
              <p className="font-medium text-lg">
                Largo de {fit.length.min} a {fit.length.max} mm, ancho de {fit.width.min} a {fit.width.max} mm
              </p>
              <p className="text-muted-foreground text-sm">Es una orientación: cada mano es distinta.</p>
              <Button type="button" className="mt-1" onClick={showRange}>
                Ver mouses en mi rango
              </Button>
            </div>
          )}

          {hand && !reported && <MouseFitReport hand={hand} onDone={() => setReported(true)} />}

          {saved && (
            <Button type="button" variant="ghost" size="sm" className="self-center" onClick={forget}>
              Borrar mis medidas
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
