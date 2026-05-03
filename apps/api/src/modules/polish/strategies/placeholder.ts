export class PlaceholderManager {
  private readonly map = new Map<string, string>();
  private readonly counter = { ref: 0, formula: 0, code: 0, term: 0 };

  encode(text: string, preserveTerms: string[] = []): string {
    let out = text;

    out = this.encodeCodeBlocks(out);
    out = this.encodeFormulas(out);
    out = this.encodeRefs(out);
    out = this.encodeTerms(out, preserveTerms);

    return out;
  }

  decode(text: string): string {
    let out = text;
    for (const [placeholder, original] of this.map.entries()) {
      out = out.split(placeholder).join(original);
    }
    return out;
  }

  private next(kind: keyof typeof this.counter, prefix: string): string {
    this.counter[kind] += 1;
    const n = String(this.counter[kind]).padStart(3, '0');
    return `[${prefix}_${n}]`;
  }

  private put(placeholder: string, original: string): string {
    this.map.set(placeholder, original);
    return placeholder;
  }

  private encodeRefs(text: string): string {
    return text.replace(/\[(\d{1,4})\]/g, (m) =>
      this.put(this.next('ref', 'REF'), m),
    );
  }

  private encodeFormulas(text: string): string {
    let out = text;

    out = out.replace(/\$\$[\s\S]*?\$\$/g, (m) =>
      this.put(this.next('formula', 'FORMULA'), m),
    );

    out = out.replace(/\$(?!\$)[\s\S]*?\$(?!\$)/g, (m) =>
      this.put(this.next('formula', 'FORMULA'), m),
    );

    return out;
  }

  private encodeCodeBlocks(text: string): string {
    return text.replace(/```[\s\S]*?```/g, (m) =>
      this.put(this.next('code', 'CODE'), m),
    );
  }

  private encodeTerms(text: string, preserveTerms: string[]): string {
    let out = text;
    const terms = [
      ...new Set(preserveTerms.map((t) => t.trim()).filter(Boolean)),
    ].sort((a, b) => b.length - a.length);

    for (const term of terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'g');
      out = out.replace(re, (m) => this.put(this.next('term', 'TERM'), m));
    }
    return out;
  }
}
