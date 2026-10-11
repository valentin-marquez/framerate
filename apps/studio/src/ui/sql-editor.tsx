import type { CompletionContext } from "@codemirror/autocomplete";
import { SQLite, sql } from "@codemirror/lang-sql";
import { Compartment, Prec } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useRef } from "react";

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
  ".cm-tooltip-autocomplete": { fontFamily: "var(--font-mono)" },
});

export const tablesInScope = (text: string) =>
  [...text.matchAll(/\b(?:from|join|update|into)\s+"?(\w+)"?/gi)].map((m) => (m[1] as string).toLowerCase());

// lang-sql sólo sugiere columnas tras "tabla.": esto ofrece las de las tablas ya nombradas en la consulta.
const columnsInScope = (schema: Record<string, string[]>) => (ctx: CompletionContext) => {
  const word = ctx.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  const tables = [...new Set(tablesInScope(ctx.state.doc.toString()))];
  const options = tables.flatMap((t) =>
    (schema[t] ?? []).map((c) => ({ label: c, type: "property", detail: t, boost: 1 })),
  );
  return options.length ? { from: word.from, options } : null;
};

const language = (schema: Record<string, string[]>) => [
  sql({ dialect: SQLite, schema, upperCaseKeywords: false }),
  SQLite.language.data.of({ autocomplete: columnsInScope(schema) }),
];

// CodeMirror maneja su propio estado: se crea una vez y React sólo le empuja el texto externo y el esquema.
export function SqlEditor({
  value,
  onChange,
  onRun,
  schema,
  dark,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  schema: Record<string, string[]>;
  dark: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const lang = useRef(new Compartment());
  const look = useRef(new Compartment());
  const cb = useRef({ onChange, onRun });
  cb.current = { onChange, onRun };

  // biome-ignore lint/correctness/useExhaustiveDependencies: se monta una sola vez; value y schema se sincronizan abajo
  useEffect(() => {
    view.current = new EditorView({
      parent: host.current as HTMLDivElement,
      doc: value,
      extensions: [
        Prec.highest(
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                cb.current.onRun();
                return true;
              },
            },
          ]),
        ),
        basicSetup,
        lang.current.of(language(schema)),
        look.current.of(dark ? oneDark : []),
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) cb.current.onChange(u.state.doc.toString());
        }),
      ],
    });
    return () => view.current?.destroy();
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value)
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: lang.current.reconfigure(language(schema)),
    });
  }, [schema]);

  useEffect(() => {
    view.current?.dispatch({ effects: look.current.reconfigure(dark ? oneDark : []) });
  }, [dark]);

  return <div ref={host} className="h-full overflow-hidden rounded-md border border-kumo-line" />;
}
