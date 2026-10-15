import { Button, InputArea, Popover } from "@cloudflare/kumo";
import { useState } from "react";
import { formatted } from "../format";

export type Editing = { anchor: HTMLElement; column: string; value: unknown; nonce: number };

const Kbd = ({ children }: { children: string }) => (
  <kbd className="rounded border border-kumo-line px-1 font-mono text-[11px]">{children}</kbd>
);

// Como el editor de celda de Supabase: un recuadro amplio sobre la celda, con NULL, "ahora" y la vista formateada.
export function CellEditor({
  editing,
  onCommit,
  onClose,
}: {
  editing?: Editing;
  onCommit: (value: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Popover open={editing !== undefined} onOpenChange={(open) => !open && onClose()}>
      <Popover.Content anchor={editing?.anchor} side="bottom" align="start" className="w-[32rem] max-w-[90vw] p-3">
        {editing && <CellForm key={editing.nonce} editing={editing} onCommit={onCommit} onClose={onClose} />}
      </Popover.Content>
    </Popover>
  );
}

function CellForm({
  editing,
  onCommit,
  onClose,
}: {
  editing: Editing;
  onCommit: (value: string | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(editing.value === null ? "" : String(editing.value));
  const preview = formatted(text);
  const looksDate = /^\d{4}-\d{2}-\d{2}T/.test(text);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs text-kumo-subtle">{editing.column}</span>
      <InputArea
        aria-label={editing.column}
        autoFocus
        autoResize
        minRows={2}
        maxRows={14}
        spellCheck={false}
        className="w-full font-mono text-[13px]"
        value={text}
        placeholder={editing.value === null ? "NULL" : ""}
        onValueChange={setText}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onCommit(text);
          }
        }}
      />
      {preview && (
        <pre className="max-h-48 overflow-auto rounded-md bg-kumo-recessed p-2 font-mono text-xs">{preview}</pre>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-kumo-subtle">
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> guardar
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Shift ↵</Kbd> nueva línea
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Esc</Kbd> cancelar
        </span>
        <div className="ml-auto flex gap-1">
          {looksDate && (
            <Button size="xs" onClick={() => onCommit(new Date().toISOString())}>
              Ahora
            </Button>
          )}
          <Button size="xs" onClick={() => onCommit(null)}>
            NULL
          </Button>
          <Button size="xs" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
