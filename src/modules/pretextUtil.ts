import { layout, prepare } from "@chenglou/pretext";

// Optional helper. Use when need accurate wrapping/height without DOM reflow.
export function measureParagraphHeight(opts: {
  text: string;
  font: string;
  maxWidthPx: number;
  lineHeightPx: number;
}): { height: number; lineCount: number } {
  const prepared = prepare(opts.text, opts.font);
  return layout(prepared, opts.maxWidthPx, opts.lineHeightPx);
}

