type PdfLine = { text: string; size?: number; gap?: number };

function wrap(text: string, width = 88) {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= width) line += ` ${word}`;
      else { result.push(line); line = word; }
    }
    result.push(line);
  }
  return result;
}

function escapeText(text: string) {
  return text.replace(/[–—]/g, "-").split("").map((char) => {
    const code = char.charCodeAt(0);
    if ("\\()".includes(char)) return `\\${char}`;
    return code >= 32 && code <= 255 ? char : "?";
  }).join("");
}

function build(lines: PdfLine[]) {
  const pages: string[][] = [[]];
  let y = 790;
  for (const line of lines) {
    const size = line.size ?? 10;
    const height = size + (line.gap ?? 4);
    if (y - height < 52) { pages.push([]); y = 790; }
    if (line.text) pages.at(-1)!.push(`BT /F1 ${size} Tf 48 ${y} Td (${escapeText(line.text)}) Tj ET`);
    y -= height;
  }
  const objects: string[] = [];
  const pageStart = 3;
  const contentStart = pageStart + pages.length;
  const fontId = contentStart + pages.length;
  const pageIds = pages.map((_, index) => pageStart + index);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  pages.forEach((content, index) => {
    const stream = content.join("\n");
    objects[pageStart + index] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentStart + index} 0 R >>`;
    objects[contentStart + index] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = pdf.length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export function createPamPdf(input: { employeeName: string; jobTitle: string | null; feedbackDate: string | null; completedAt: string | null; items: Array<Record<string, unknown>> }) {
  const lines: PdfLine[] = [
    { text: "Plano de Acao para Melhoria (PAM)", size: 18, gap: 12 },
    { text: `Colaborador: ${input.employeeName}`, size: 12, gap: 6 },
    { text: `Cargo: ${input.jobTitle || "Nao informado"}`, size: 10, gap: 6 },
    { text: `Feedback: ${input.feedbackDate || "Nao informado"}`, size: 10, gap: 6 },
    { text: `Finalizado em: ${input.completedAt || "Nao informado"}`, size: 10, gap: 18 },
  ];
  input.items.forEach((item, index) => {
    lines.push({ text: `${index + 1}. ${String(item.improvement_point ?? "Ponto de melhoria")}`, size: 13, gap: 8 });
    const fields = [["Pergunta", item.question_label], ["Por que isso e um problema?", item.problem_reason], ["Como pretende melhorar?", item.improvement_plan], ["Como vai conferir a evolucao?", item.evidence_plan]];
    for (const [label, value] of fields) {
      lines.push({ text: String(label), size: 10, gap: 4 });
      wrap(String(value ?? "")).forEach((text) => lines.push({ text: `  ${text}`, size: 10, gap: 3 }));
    }
    lines.push({ text: "", gap: 14 });
  });
  return build(lines);
}

export function safePamFilename(name: string) {
  const clean = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, " ") || "Colaborador";
  return `PAM - ${clean}.pdf`;
}
