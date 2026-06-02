import { saveAs } from "file-saver";
import type { MarketingAudit } from "./marketingAudit";

type PdfPage = { content: string[] };

function pdfText(value: string) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function sanitizeFilePart(value: string, fallback = "audit") {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return cleaned || fallback;
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

class SimpleAuditPdf {
  private pages: PdfPage[] = [];
  private page: PdfPage = { content: [] };
  private y = 790;
  private readonly width = 612;
  private readonly height = 792;
  private readonly left = 54;
  private readonly bottom = 56;

  constructor() {
    this.pages.push(this.page);
  }

  private newPage() {
    this.page = { content: [] };
    this.pages.push(this.page);
    this.y = 790;
  }

  private ensure(height: number) {
    if (this.y - height < this.bottom) this.newPage();
  }

  private text(value: string, size = 10, bold = false, x = this.left, color = "111827") {
    const font = bold ? "F2" : "F1";
    const rgb = color.match(/.{2}/g)?.map((part) => parseInt(part, 16) / 255) || [0, 0, 0];
    this.page.content.push(`BT /${font} ${size.toFixed(2)} Tf ${rgb.map((item) => item.toFixed(3)).join(" ")} rg ${x.toFixed(2)} ${this.y.toFixed(2)} Td (${pdfText(value)}) Tj ET`);
  }

  private wrapped(value: string, size = 10, bold = false, color = "334155", indent = 0) {
    const maxChars = Math.max(42, Math.floor((88 - indent) * (10 / size)));
    const words = String(value || "").split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    this.ensure(lines.length * (size + 5) + 8);
    for (const item of lines) {
      this.text(item, size, bold, this.left + indent, color);
      this.y -= size + 5;
    }
  }

  heading(title: string, subtitle?: string) {
    this.ensure(60);
    this.text(title, 18, true, this.left, "0f172a");
    this.y -= 22;
    if (subtitle) {
      this.wrapped(subtitle, 10, false, "475569");
    }
    this.y -= 10;
  }

  section(title: string) {
    this.ensure(34);
    this.y -= 8;
    this.text(title, 13, true, this.left, "1e293b");
    this.y -= 20;
  }

  paragraph(value: string) {
    this.wrapped(value, 10, false, "334155");
    this.y -= 6;
  }

  bullets(values: string[]) {
    for (const value of values.filter(Boolean)) {
      this.wrapped(`- ${value}`, 9.5, false, "334155", 8);
    }
    this.y -= 4;
  }

  keyValues(rows: Array<[string, string]>) {
    for (const [key, value] of rows) {
      this.ensure(22);
      this.text(key, 9, true, this.left, "64748b");
      this.text(value, 9.5, false, this.left + 160, "0f172a");
      this.y -= 18;
    }
    this.y -= 6;
  }

  cards(rows: Array<[string, string, string]>) {
    for (const [title, target, competitor] of rows) {
      this.ensure(46);
      this.text(title, 10, true, this.left, "0f172a");
      this.y -= 15;
      this.text(`This profile: ${target}`, 9.5, false, this.left + 12, "334155");
      this.y -= 14;
      this.text(`Comparison: ${competitor}`, 9.5, false, this.left + 12, "334155");
      this.y -= 16;
    }
    this.y -= 4;
  }

  toBlob() {
    this.pages.forEach((page, index) => {
      page.content.push(`BT /F1 8 Tf 0.580 0.639 0.722 rg 520 24 Td (${pdfText(`Page ${index + 1}`)}) Tj ET`);
    });
    return pdfPagesToBlob(this.pages, this.width, this.height);
  }
}

function pdfPagesToBlob(pages: PdfPage[], width: number, height: number) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let offset = 0;
  const append = (value: string) => {
    const bytes = encoder.encode(value);
    chunks.push(bytes);
    offset += bytes.length;
  };
  const writeObject = (id: number, body: string) => {
    offsets[id] = offset;
    append(`${id} 0 obj\n${body}\nendobj\n`);
  };

  const catalogId = 1;
  const pagesId = 2;
  const fontRegularId = 3;
  const fontBoldId = 4;
  const pageIds = pages.map((_, index) => 5 + index * 2);
  const contentIds = pages.map((_, index) => 6 + index * 2);
  const objectCount = 4 + pages.length * 2;

  append("%PDF-1.4\n");
  writeObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  writeObject(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  writeObject(fontRegularId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  writeObject(fontBoldId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((page, index) => {
    const content = page.content.join("\n");
    writeObject(contentIds[index], `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
    writeObject(pageIds[index], `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`);
  });

  const xrefOffset = offset;
  append(`xref\n0 ${objectCount + 1}\n`);
  append("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    append(`${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${objectCount + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  const bytes = concatBytes(chunks);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: "application/pdf" });
}

export function marketingAuditPdfBlob(audit: MarketingAudit) {
  const pdf = new SimpleAuditPdf();
  const copy = audit.ownerFacingCopy;
  pdf.heading(`${audit.businessName} Google Business Profile Audit`, `Score ${audit.score.total}/100 - ${audit.score.label}. Generated ${new Date(audit.generatedAt).toLocaleDateString()}.`);
  pdf.keyValues([
    ["Business", audit.businessName],
    ["Reference", audit.businessId],
    ["Industry profile", copy.industryLabel],
    ["Confidence", audit.confidence],
    ["Query / city", [audit.source.query, audit.source.city].filter(Boolean).join(" / ") || "-"],
  ]);
  pdf.section("Why This Matters");
  pdf.paragraph(copy.problemFrame);
  pdf.paragraph(copy.customerJourneyRisk);
  pdf.paragraph(copy.operationalPressure);
  pdf.paragraph(copy.evidenceLine);
  pdf.section("Evidence Panels");
  pdf.cards(audit.evidence.comparisonCards.map((card) => [
    card.title,
    `${card.targetLabel}: ${card.targetValue}`,
    `${card.competitorLabel}: ${card.competitorValue}`,
  ]));
  pdf.section("Score Breakdown");
  audit.score.categories.forEach((category) => {
    pdf.paragraph(`${category.label}: ${category.score}/${category.max} - ${category.summary}`);
    pdf.bullets(category.evidence.slice(0, 3));
  });
  pdf.section("Recommended Action Plan");
  pdf.paragraph(copy.directRecommendation);
  audit.offer.services.forEach((service) => {
    pdf.paragraph(`${service.title}: ${service.description}`);
    pdf.bullets(service.recommendedBecause.slice(0, 2));
  });
  pdf.section("Source Notes");
  pdf.bullets([
    "Based on available Google profile data captured by WebView.click and cached local competitor rows.",
    ...audit.missingDataNotes,
    "This is not a guarantee of ranking, calls, or revenue. It is a profile-readiness comparison from available data.",
  ]);
  return pdf.toBlob();
}

export function downloadMarketingAuditPdf(audit: MarketingAudit) {
  const filename = `WebView.click GBP Audit - ${sanitizeFilePart(audit.businessName || audit.businessId)}.pdf`;
  saveAs(marketingAuditPdfBlob(audit), filename);
}
