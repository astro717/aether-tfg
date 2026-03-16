/**
 * PDF Generator Utility
 * High-fidelity PDF generation for AI reports with professional design
 * NOW with multi-chart capture for enterprise visualizations
 */

import jsPDF, { GState } from 'jspdf';
import html2canvas from 'html2canvas';
import 'svg2pdf.js';

// ── Font family ─────────────────────────────────────────────────────────────
// Starts as 'helvetica' (jsPDF built-in). Flips to 'Inter' once the CDN load
// succeeds. All setFont calls read this so they get Inter automatically.
const FONT = { family: 'helvetica' as string };

// ── Inter font cache ─────────────────────────────────────────────────────────
// Base64 strings cached after first fetch so subsequent PDFs skip the network.
let _interCache: { regular: string; bold: string } | null = null;
let _interLoading: Promise<void> | null = null;

function _applyInterToDoc(doc: jsPDF, cache: { regular: string; bold: string }): void {
  doc.addFileToVFS('Inter-Regular.ttf', cache.regular);
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFileToVFS('Inter-Bold.ttf', cache.bold);
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
}

/**
 * Fetch Inter Regular + Bold TTF from CDN, register with jsPDF, and cache.
 * Falls back to Helvetica silently on any network / parsing failure.
 * Must be awaited before the first page content is rendered.
 */
async function loadInterFont(doc: jsPDF): Promise<void> {
  // Already loaded — just re-register on this doc instance
  if (_interCache) {
    _applyInterToDoc(doc, _interCache);
    return;
  }
  // Deduplicate concurrent calls (e.g. parallel report triggers)
  if (_interLoading) {
    await _interLoading;
    if (_interCache) _applyInterToDoc(doc, _interCache);
    return;
  }

  _interLoading = (async () => {
    try {
      // @expo-google-fonts/inter ships confirmed TTF files — reliable jsDelivr CDN
      const BASE = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.2';
      const [regRes, boldRes] = await Promise.all([
        fetch(`${BASE}/Inter_400Regular.ttf`),
        fetch(`${BASE}/Inter_700Bold.ttf`),
      ]);
      if (!regRes.ok || !boldRes.ok) throw new Error(`CDN ${regRes.status}/${boldRes.status}`);

      const bufToB64 = async (res: Response): Promise<string> => {
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        // Process in chunks — avoids call-stack overflow on large buffers
        const CHUNK = 0x8000;
        let bin = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        return btoa(bin);
      };

      const [regular, bold] = await Promise.all([bufToB64(regRes), bufToB64(boldRes)]);
      _interCache = { regular, bold };
      FONT.family = 'Inter';
      console.log('✓ Inter font loaded');
    } catch (e) {
      console.warn('Inter unavailable — falling back to Helvetica', e);
    }
  })();

  await _interLoading;
  if (_interCache) _applyInterToDoc(doc, _interCache);
}

// Aether color palette — single brand accent system
// ONE primary (indigo-500). Semantic trio for status. Neutral scale for text/borders.
const COLORS = {
  primary: {
    purple: [99, 102, 241] as [number,number,number],  // #6366f1 — sole brand accent
    blue:   [99, 102, 241] as [number,number,number],  // unified → same indigo
    indigo: [99, 102, 241] as [number,number,number],  // unified → same indigo
  },
  semantic: {
    success: [16, 185, 129]  as [number,number,number], // emerald-500 #10b981
    warning: [245, 158, 11]  as [number,number,number], // amber-500  #f59e0b
    danger:  [239, 68, 68]   as [number,number,number], // red-500    #ef4444
  },
  neutral: {
    dark:   [17, 24, 39]     as [number,number,number], // gray-900 #111827
    medium: [107, 114, 128]  as [number,number,number], // gray-500 #6b7280
    light:  [243, 244, 246]  as [number,number,number], // gray-100 #f3f4f6
    border: [229, 231, 235]  as [number,number,number], // gray-200 #e5e7eb
    muted:  [156, 163, 175]  as [number,number,number], // gray-400 #9ca3af
  },
} as const;

// Typography hierarchy — 3+ pt gap between levels creates real visual hierarchy
const FONTS = {
  h1:      { size: 18,  weight: 'bold'   as const }, // chapter titles
  h2:      { size: 13,  weight: 'bold'   as const }, // section headings (was 14 — barely different from h1)
  h3:      { size: 11,  weight: 'bold'   as const }, // chart captions, sub-section
  body:    { size: 9.5, weight: 'normal' as const }, // body copy
  small:   { size: 9,   weight: 'normal' as const },
  caption: { size: 7,   weight: 'normal' as const }, // labels, footers
} as const;

// Layout constants (in mm)
const LAYOUT = {
  margin: {
    top: 25,
    bottom: 25,
    left: 18,
    right: 18,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
  spacing: {
    section: 12,
    paragraph: 6,
    small: 4,
  },
} as const;

interface BaseReportMetadata {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  cached?: boolean;
}

interface ManagerReportData extends BaseReportMetadata {
  type: 'manager';
  organizationName: string;
  period: string;
  reportType: string;
  summary: string;
  sections: Array<{ title: string; content: string }>;
}

interface TaskReportData extends BaseReportMetadata {
  type: 'task';
  taskTitle: string;
  summary: string;
  sections: Array<{ title: string; content: string }>;
}

interface CodeAnalysisData extends BaseReportMetadata {
  type: 'code_analysis';
  commitSha: string;
  summary: string;
  score: string;
  issues: Array<{
    severity: 'high' | 'medium' | 'low';
    title: string;
    file: string;
    line: number;
  }>;
}

interface CommitExplanationData extends BaseReportMetadata {
  type: 'commit_explanation';
  commitSha: string;
  taskTitle: string;
  readableId: string;
  explanation: string;
  howItFulfillsTask: string;
  technicalDetails: string;
  remainingWork: string[];
}

// Type union for all report data types (for future extensibility)
// type ReportData =
//   | ManagerReportData
//   | TaskReportData
//   | CodeAnalysisData
//   | CommitExplanationData;

/**
 * PDF Generator Class
 * Handles all PDF generation with consistent styling and branding
 */
class PDFGenerator {
  public doc: jsPDF; // Public for direct access in constrained layout rendering
  public currentY: number; // Made public for external layout calculations
  private pageWidth: number;
  private pageHeight: number;
  public contentWidth: number; // Made public for external layout calculations
  private pageNumber: number;
  private runningHeaderContext: { title: string; orgName: string } | null = null;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - LAYOUT.margin.left - LAYOUT.margin.right;
    this.currentY = LAYOUT.margin.top;
    this.pageNumber = 1;
    // Re-register Inter on this doc instance if it was loaded in a prior generation
    if (_interCache) _applyInterToDoc(this.doc, _interCache);
  }

  public setRunningHeader(title: string, orgName: string): void {
    this.runningHeaderContext = { title, orgName };
  }

  /**
   * Simulates a vertical gradient by drawing N thin rects with interpolated color
   */
  private drawVerticalGradient(
    x: number, y: number, w: number, h: number,
    colorTop: [number, number, number],
    colorBottom: [number, number, number],
    steps = 30
  ): void {
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(colorTop[0] + (colorBottom[0] - colorTop[0]) * t);
      const g = Math.round(colorTop[1] + (colorBottom[1] - colorTop[1]) * t);
      const b = Math.round(colorTop[2] + (colorBottom[2] - colorTop[2]) * t);
      this.doc.setFillColor(r, g, b);
      const sliceH = h / steps + 0.5; // +0.5 prevents hairline gaps
      this.doc.rect(x, y + (h / steps) * i, w, sliceH, 'F');
    }
  }

  /**
   * Add a branded cover page (page 1). Adds a new page after it.
   * Page numbering resets so cover doesn't count.
   */
  public addCoverPage(title: string, orgName: string, period: string, reportType?: string): void {
    // Full-page gradient background: deep indigo — matches #3730a3 → #1e1b4b
    this.drawVerticalGradient(
      0, 0, this.pageWidth, this.pageHeight,
      [55, 48, 163],   // #3730a3 indigo-800
      [30, 27, 75]     // #1e1b4b indigo-950
    );

    // Subtle noise texture — horizontal lines at low opacity
    this.doc.setDrawColor(255, 255, 255);
    this.doc.setLineWidth(0.05);
    for (let lineY = 10; lineY < this.pageHeight; lineY += 4) {
      this.doc.setGState(new GState({ opacity: 0.04, 'stroke-opacity': 0.04 }));
      this.doc.line(0, lineY, this.pageWidth, lineY);
    }
    this.doc.setGState(new GState({ opacity: 1, 'stroke-opacity': 1 }));

    // ── Logo ────────────────────────────────────────────────────────────────
    this.doc.setFontSize(28);
    this.doc.setFont(FONT.family, 'normal');
    this.doc.setTextColor(255, 255, 255);
    this.doc.text('aether.', this.pageWidth / 2, 75, { align: 'center' });

    // Tagline under logo
    this.doc.setFontSize(9);
    this.doc.setFont(FONT.family, 'normal');
    this.doc.setTextColor(180, 180, 255);
    this.doc.text('AI-powered project intelligence', this.pageWidth / 2, 83, { align: 'center' });

    // ── Divider ─────────────────────────────────────────────────────────────
    this.doc.setDrawColor(255, 255, 255);
    this.doc.setGState(new GState({ opacity: 0.25, 'stroke-opacity': 0.25 }));
    this.doc.setLineWidth(0.4);
    this.doc.line(this.pageWidth / 2 - 25, 92, this.pageWidth / 2 + 25, 92);
    this.doc.setGState(new GState({ opacity: 1, 'stroke-opacity': 1 }));

    // ── Report title ────────────────────────────────────────────────────────
    this.doc.setFontSize(20);
    this.doc.setFont(FONT.family, 'bold');
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(title, this.pageWidth / 2, 115, { align: 'center', maxWidth: 150 });

    if (reportType) {
      this.doc.setFontSize(10);
      this.doc.setFont(FONT.family, 'normal');
      this.doc.setTextColor(200, 200, 255);
      this.doc.text(reportType, this.pageWidth / 2, 124, { align: 'center' });
    }

    // ── Metadata pill ───────────────────────────────────────────────────────
    const pillW = 90;
    const pillX = this.pageWidth / 2 - pillW / 2;
    const pillY = 140;
    this.doc.setFillColor(255, 255, 255);
    this.doc.setGState(new GState({ opacity: 0.1, 'stroke-opacity': 0.1 }));
    this.doc.roundedRect(pillX, pillY, pillW, 24, 4, 4, 'F');
    this.doc.setGState(new GState({ opacity: 1, 'stroke-opacity': 1 }));

    this.doc.setFontSize(11);
    this.doc.setFont(FONT.family, 'bold');
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(orgName, this.pageWidth / 2, pillY + 9, { align: 'center' });

    this.doc.setFontSize(9);
    this.doc.setFont(FONT.family, 'normal');
    this.doc.setTextColor(200, 200, 255);
    this.doc.text(period, this.pageWidth / 2, pillY + 18, { align: 'center' });

    // ── Generation date (bottom) ─────────────────────────────────────────
    const genDate = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    this.doc.setFontSize(8);
    this.doc.setFont(FONT.family, 'normal');
    this.doc.setTextColor(150, 150, 200);
    this.doc.text(
      `Generated ${genDate} · Confidential`,
      this.pageWidth / 2,
      this.pageHeight - 20,
      { align: 'center' }
    );

    // ── Start content on next page ──────────────────────────────────────────
    this.doc.addPage();
    this.pageNumber = 1; // Cover doesn't count
    this.currentY = LAYOUT.margin.top;
  }

  /**
   * Check if we need a new page and add one if necessary
   */
  public checkPageBreak(heightNeeded: number): void {
    if (this.currentY + heightNeeded > this.pageHeight - LAYOUT.margin.bottom) {
      this.addPage();
    }
  }

  /**
   * Add a new page with running header and footer
   */
  private addPage(): void {
    this.doc.addPage();
    this.pageNumber++;
    this.currentY = LAYOUT.margin.top;
    // Running mini-header on pages 2+
    if (this.runningHeaderContext) {
      const hY = LAYOUT.margin.top - 10;
      this.doc.setFontSize(7);
      this.doc.setFont(FONT.family, 'normal');
      this.doc.setTextColor(170, 173, 180);
      this.doc.text(
        `${this.runningHeaderContext.orgName}  ·  ${this.runningHeaderContext.title}`,
        LAYOUT.margin.left,
        hY
      );
      this.doc.setDrawColor(220, 222, 228);
      this.doc.setLineWidth(0.2);
      this.doc.line(LAYOUT.margin.left, hY + 2, this.pageWidth - LAYOUT.margin.right, hY + 2);
    }
    this.addFooter();
  }

  /**
   * Add header with logo and report metadata
   */
  public addHeader(metadata: BaseReportMetadata): void {
    const logoSize = 40;
    const logoX = LAYOUT.margin.left;
    const logoY = LAYOUT.margin.top - 10;

    // Logo (left side) - Simple "aether." text logo
    try {
      // Use Helvetica (closest to SF Pro available in jsPDF)
      this.doc.setFontSize(14);
      this.doc.setFont(FONT.family, 'normal');
      this.doc.setTextColor(0, 0, 0); // Black
      this.doc.text('aether.', logoX, logoY + 8);
    } catch (error) {
      console.warn('Failed to add logo', error);
    }

    // Report title and metadata (right side)
    const metadataX = logoX + logoSize + 10;

    this.doc.setFontSize(FONTS.h1.size);
    this.doc.setFont(FONT.family, FONTS.h1.weight);
    this.doc.setTextColor(...COLORS.neutral.dark);
    this.doc.text(metadata.title, metadataX, logoY + 8, { maxWidth: this.pageWidth - metadataX - LAYOUT.margin.right });

    if (metadata.subtitle) {
      this.doc.setFontSize(FONTS.small.size);
      this.doc.setFont(FONT.family, 'normal');
      this.doc.setTextColor(...COLORS.neutral.medium);
      this.doc.text(metadata.subtitle, metadataX, logoY + 14);
    }

    // Generated date — format ISO string to human-readable
    const rawDate = metadata.generatedAt ? new Date(metadata.generatedAt) : new Date();
    const generatedText = rawDate.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    }) + ' · ' + rawDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const cachedBadge = metadata.cached ? ' · Cached' : '';
    this.doc.setFontSize(FONTS.caption.size);
    this.doc.setTextColor(...COLORS.neutral.medium);
    this.doc.text(`Generated: ${generatedText}${cachedBadge}`, metadataX, logoY + 18);

    // Separator line with gradient effect (simulated with multiple lines)
    const separatorY = logoY + 22;
    this.doc.setDrawColor(...COLORS.primary.purple);
    this.doc.setLineWidth(0.5);
    this.doc.line(LAYOUT.margin.left, separatorY, this.pageWidth - LAYOUT.margin.right, separatorY);

    this.currentY = separatorY + LAYOUT.spacing.section;
  }

  /**
   * Add footer with page number and confidentiality notice
   */
  public addFooter(): void {
    const footerY = this.pageHeight - LAYOUT.margin.bottom + 10;

    this.doc.setFontSize(FONTS.caption.size);
    this.doc.setFont(FONT.family, 'normal');
    this.doc.setTextColor(...COLORS.neutral.medium);

    // Confidentiality notice (left)
    this.doc.text(
      `Generated by Aether AI - ${new Date().toLocaleDateString()} - Confidential`,
      LAYOUT.margin.left,
      footerY
    );

    // Page number (right)
    this.doc.text(
      `Page ${this.pageNumber}`,
      this.pageWidth - LAYOUT.margin.right,
      footerY,
      { align: 'right' }
    );
  }

  /**
   * Add executive summary box with styled background
   */
  public addSummaryBox(title: string, content: string): void {
    this.checkPageBreak(40);

    // Background box
    const boxY = this.currentY;
    const boxHeight = this.calculateTextHeight(content, this.contentWidth - 14, FONTS.body.size) + 15;

    // Indigo-tinted background
    this.doc.setFillColor(240, 244, 255);
    this.doc.roundedRect(
      LAYOUT.margin.left,
      boxY,
      this.contentWidth,
      boxHeight,
      2,
      2,
      'F'
    );

    // Left accent bar (indigo)
    this.doc.setFillColor(99, 102, 241);
    this.doc.rect(LAYOUT.margin.left, boxY, 2.5, boxHeight, 'F');

    // Title
    this.doc.setFontSize(FONTS.h3.size);
    this.doc.setFont(FONT.family, FONTS.h3.weight);
    this.doc.setTextColor(67, 56, 202); // indigo-700
    this.doc.text(title, LAYOUT.margin.left + 8, boxY + 7);

    // Content
    this.currentY = boxY + 14;

    this.renderRichText(content, LAYOUT.margin.left + 8, this.contentWidth - 14);

    // Box height is fixed visually, jump Y passed the box
    this.currentY = boxY + boxHeight + LAYOUT.spacing.section;
  }

  /**
   * Add a section with title and content.
   * Sprint 3: chapter-opener style — indigo-50 band + 3mm left indigo bar.
   * Replaces the old hairline rule + bullet approach (rules were visually
   * clinging to the following title regardless of spacing tweaks).
   */
  public addSection(title: string, content: string): void {
    this.checkPageBreak(22);

    // ── Chapter opener band ──────────────────────────────────────────────────
    const bandH = 10;
    // Very soft tint (245,247,255) — lighter than indigo-50, avoids the "Word doc" blockiness
    this.doc.setFillColor(245, 247, 255);
    this.doc.rect(LAYOUT.margin.left, this.currentY, this.contentWidth, bandH, 'F');
    // 3mm left accent bar — indigo-500
    this.doc.setFillColor(...COLORS.primary.indigo);
    this.doc.rect(LAYOUT.margin.left, this.currentY, 3, bandH, 'F');
    // Title — near-black for contrast against the light band
    this.doc.setFontSize(FONTS.h2.size);
    this.doc.setFont(FONT.family, FONTS.h2.weight);
    this.doc.setTextColor(...COLORS.neutral.dark);
    this.doc.text(title, LAYOUT.margin.left + 8, this.currentY + 7);

    this.currentY += bandH + 5; // band + 5mm breathing room before content

    // ── Section content ──────────────────────────────────────────────────────
    this.renderRichText(content, LAYOUT.margin.left + 4, this.contentWidth - 4);
    this.currentY += 10; // bottom margin before next section
  }

  /**
   * Add severity pill for code analysis issues
   */
  private addSeverityPill(severity: 'high' | 'medium' | 'low', x: number, y: number): number {
    const colors = {
      high: COLORS.semantic.danger,
      medium: COLORS.semantic.warning,
      low: COLORS.neutral.medium,
    };

    const labels = {
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
    };

    const color = colors[severity];
    const label = labels[severity];
    const width = 20;

    // Draw pill background
    this.doc.setFillColor(color[0], color[1], color[2]);
    this.doc.roundedRect(x, y - 3, width, 5, 1, 1, 'F');

    // Draw label
    this.doc.setFontSize(FONTS.caption.size);
    this.doc.setFont(FONT.family, 'bold');
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(label, x + width / 2, y, { align: 'center' });

    return width + 3;
  }

  /**
   * Add code analysis issues with severity indicators
   */
  private addCodeIssues(issues: CodeAnalysisData['issues']): void {
    this.checkPageBreak(20);

    this.doc.setFontSize(FONTS.h2.size);
    this.doc.setFont(FONT.family, FONTS.h2.weight);
    this.doc.setTextColor(...COLORS.primary.blue);
    this.doc.text('Identified Issues', LAYOUT.margin.left, this.currentY);
    this.currentY += LAYOUT.spacing.paragraph;

    for (const issue of issues) {
      this.checkPageBreak(15);

      const issueY = this.currentY;

      // Severity pill
      const pillWidth = this.addSeverityPill(issue.severity, LAYOUT.margin.left, issueY);

      // Issue title
      this.doc.setFontSize(FONTS.body.size);
      this.doc.setFont(FONT.family, 'bold');
      this.doc.setTextColor(...COLORS.neutral.dark);
      this.doc.text(issue.title, LAYOUT.margin.left + pillWidth + 2, issueY);
      this.currentY += 6;

      // File and line info
      this.doc.setFont(FONT.family, 'normal');
      this.doc.setFontSize(FONTS.small.size);
      this.doc.setTextColor(...COLORS.neutral.medium);
      this.doc.text(`${issue.file}:${issue.line}`, LAYOUT.margin.left + 5, this.currentY);
      this.currentY += 5 + LAYOUT.spacing.paragraph;
    }
  }

  /**
   * Calculate text height for box sizing
   */
  private calculateTextHeight(text: string, maxWidth: number, fontSize: number): number {
    this.doc.setFontSize(fontSize);
    const lines = this.doc.splitTextToSize(text, maxWidth);
    return lines.length * 5;
  }

  /**
   * Clean markdown-style formatting from text
   */
  public cleanMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/#{1,6}\s/g, '') // Headers
      .replace(/`(.*?)`/g, '$1'); // Code
  }

  /**
   * Helper to render Rich Text (Markdown bold and lists) with word wrapping
   */
  private renderRichText(text: string, startX: number, maxWidth: number): void {
    this.doc.setFontSize(FONTS.body.size);
    this.doc.setTextColor(...COLORS.neutral.dark);

    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        this.currentY += 3; // Empty line spacing
        continue;
      }

      let indentOffset = 0;
      let paragraphText = paragraph;
      let isBullet = false;
      let bulletText = '';
      let isFirstLine = true;

      // Handle list items (bullet points or numbered lists)
      const listMatch = paragraphText.match(/^(\s*)([-*]|\d+\.)\s+/);
      if (listMatch) {
        const marker = listMatch[2];
        isBullet = marker === '-' || marker === '*';
        bulletText = isBullet ? '' : marker;

        // Strip the markdown bullet/number from the text string
        paragraphText = paragraphText.substring(listMatch[0].length);
        // Indent the text block to leave room for our custom bullet/number
        indentOffset = 6;
      }

      // Parse bold tokens
      const parts = paragraphText.split(/(\*\*.*?\*\*)/g);

      let currentLine: {text: string, isBold: boolean}[] = [];
      let currentLineWidth = 0;
      let currentX = startX + indentOffset;
      const safeMaxWidth = maxWidth - indentOffset;

      const printCurrentLine = () => {
        if (currentLine.length === 0 && !isFirstLine) return;
        if (currentLine.length === 0 && isFirstLine && !listMatch) return;

        // Handle precise page breaks
        const prevPage = this.pageNumber;
        this.checkPageBreak(6);
        if (this.pageNumber !== prevPage) {
          this.doc.setFontSize(FONTS.body.size);
          this.doc.setTextColor(...COLORS.neutral.dark);
        }

        // ONLY draw the bullet/number on the first line of the list block
        if (isFirstLine && listMatch) {
          if (isBullet) {
             this.doc.setFillColor(...COLORS.primary.indigo);
             // Draw a premium circular bullet
             this.doc.circle(startX + 2, this.currentY - 1, 0.8, 'F');
          } else {
             // Draw nice bold colored numbers
             this.doc.setFont(FONT.family, 'bold');
             this.doc.setTextColor(...COLORS.primary.indigo);
             this.doc.text(bulletText, startX, this.currentY);
             // Restore text color to dark
             this.doc.setTextColor(...COLORS.neutral.dark);
          }
        }

        // Print text words
        let renderX = currentX;
        currentLine.forEach(span => {
          this.doc.setFont(FONT.family, span.isBold ? 'bold' : 'normal');
          this.doc.text(span.text, renderX, this.currentY);
          renderX += this.doc.getTextWidth(span.text);
        });

        this.currentY += 5; // Increment Y for the next line
        currentLine = [];
        currentLineWidth = 0;
        isFirstLine = false;
      };

      // Process words and fill lines
      parts.forEach(part => {
        if (!part) return;
        const isBold = part.startsWith('**') && part.endsWith('**');
        const textContent = isBold ? part.slice(2, -2) : part;

        const words = textContent.split(/(\s+)/); // Preserve spaces

        words.forEach(word => {
          if (!word) return;
          this.doc.setFont(FONT.family, isBold ? 'bold' : 'normal');
          const wordWidth = this.doc.getTextWidth(word);

          if (currentLineWidth + wordWidth > safeMaxWidth && currentLine.length > 0 && word.trim() !== '') {
            printCurrentLine();
          }

          currentLine.push({ text: word, isBold });
          currentLineWidth += wordWidth;
        });
      });

      printCurrentLine(); // Flush remaining
      this.currentY += 2; // Paragraph bottom margin
    }
  }

  /**
   * Add chart image to PDF (captured via html2canvas)
   * @param canvas - Canvas element containing the chart
   * @param title - Optional title for the chart
   * @param maxWidth - Optional max width (defaults to full content width)
   */
  public addChartImage(canvas: HTMLCanvasElement, title?: string, maxWidth?: number): void {
    const imgWidth = maxWidth || this.contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Check if we need a new page
    this.checkPageBreak(imgHeight + (title ? 15 : 5));

    // Add title if provided
    if (title) {
      this.doc.setFontSize(FONTS.h3.size);
      this.doc.setFont(FONT.family, FONTS.h3.weight);
      this.doc.setTextColor(...COLORS.primary.blue);
      this.doc.text(title, LAYOUT.margin.left, this.currentY);
      this.currentY += 8;
    }

    // Add image — 'NONE' compression preserves full pixel fidelity
    const imgData = canvas.toDataURL('image/png');
    this.doc.addImage(
      imgData,
      'PNG',
      LAYOUT.margin.left,
      this.currentY,
      imgWidth,
      imgHeight,
      undefined,
      'NONE'
    );

    this.currentY += imgHeight + LAYOUT.spacing.section;
  }

  /**
   * Add chart image at specific position (for side-by-side layouts)
   * @param canvas - Canvas element containing the chart
   * @param title - Title for the chart
   * @param x - X position on the page
   * @param y - Y position on the page
   * @param width - Width of the image
   */
  public addChartImageAtPosition(
    canvas: HTMLCanvasElement,
    title: string,
    x: number,
    y: number,
    width: number
  ): void {
    const imgHeight = (canvas.height * width) / canvas.width;

    // Add title
    this.doc.setFontSize(FONTS.h3.size);
    this.doc.setFont(FONT.family, FONTS.h3.weight);
    this.doc.setTextColor(...COLORS.primary.blue);
    this.doc.text(title, x, y);

    // Add image
    const imgData = canvas.toDataURL('image/png');
    this.doc.addImage(imgData, 'PNG', x, y + 8, width, imgHeight, undefined, 'NONE');
  }

  /**
   * Generate Manager Report PDF
   */
  generateManagerReport(data: ManagerReportData): void {
    const metadata: BaseReportMetadata = {
      title: data.title || 'Management Intelligence Report',
      subtitle: `${data.organizationName} - ${data.period}`,
      generatedAt: data.generatedAt,
      cached: data.cached,
    };

    this.addHeader(metadata);
    this.addFooter();

    // Summary
    this.addSummaryBox('Executive Summary', data.summary);

    // Sections
    for (const section of data.sections) {
      this.addSection(section.title, section.content);
    }
  }

  /**
   * Generate Task Report PDF
   */
  generateTaskReport(data: TaskReportData): void {
    const metadata: BaseReportMetadata = {
      title: 'Task Progress Report',
      subtitle: data.taskTitle,
      generatedAt: data.generatedAt,
      cached: data.cached,
    };

    this.addHeader(metadata);
    this.addFooter();

    // Summary
    this.addSummaryBox('Summary', data.summary);

    // Sections
    for (const section of data.sections) {
      this.addSection(section.title, section.content);
    }
  }

  /**
   * Generate Code Analysis PDF
   */
  generateCodeAnalysis(data: CodeAnalysisData): void {
    const metadata: BaseReportMetadata = {
      title: 'Code Security Analysis',
      subtitle: `Commit: ${data.commitSha.substring(0, 8)}`,
      generatedAt: data.generatedAt,
      cached: data.cached,
    };

    this.addHeader(metadata);
    this.addFooter();

    // Summary with score
    this.addSummaryBox(
      `Quality Score: ${data.score}`,
      data.summary
    );

    // Issues
    if (data.issues.length > 0) {
      this.addCodeIssues(data.issues);
    } else {
      this.addSection('Analysis Result', 'No security issues detected. Code quality is excellent.');
    }
  }

  /**
   * Generate Commit Explanation PDF
   */
  generateCommitExplanation(data: CommitExplanationData): void {
    const metadata: BaseReportMetadata = {
      title: 'Commit Explanation',
      subtitle: `Task #${data.readableId}: ${data.taskTitle}`,
      generatedAt: data.generatedAt,
      cached: data.cached,
    };

    this.addHeader(metadata);
    this.addFooter();

    // Commit info box
    this.checkPageBreak(15);
    this.doc.setFontSize(FONTS.small.size);
    this.doc.setFont(FONT.family, 'normal');
    this.doc.setTextColor(...COLORS.neutral.medium);
    this.doc.text(`Commit SHA: ${data.commitSha}`, LAYOUT.margin.left, this.currentY);
    this.currentY += LAYOUT.spacing.section;

    // Explanation
    this.addSummaryBox('What This Commit Does', data.explanation);

    // How It Fulfills Task
    if (data.howItFulfillsTask) {
      this.addSection('How It Fulfills the Task', data.howItFulfillsTask);
    }

    // Technical Details
    this.addSection('Technical Details', data.technicalDetails);

    // Remaining Work
    if (data.remainingWork && data.remainingWork.length > 0) {
      const remainingWorkText = data.remainingWork.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
      this.addSection('Remaining Work', remainingWorkText);
    }
  }

  /**
   * Download the generated PDF
   */
  download(filename: string): void {
    this.doc.save(filename);
  }
}

/**
 * Public API - Generate and download PDFs
 */

/**
 * Prepare a Recharts SVG for pdf rendering via svg2pdf.
 * Walks the element tree and resolves all `currentColor` references and CSS
 * class-based colours into explicit fill/stroke attributes so the cloned SVG
 * renders correctly when detached from the document stylesheet.
 */
function prepareRechartsForPDF(svgEl: SVGElement): SVGElement {
  const clone = svgEl.cloneNode(true) as SVGElement;

  function resolveNode(src: Element, dst: Element): void {
    const computed = window.getComputedStyle(src);
    const d = dst as SVGElement;

    // Resolve `currentColor` on fill / stroke attributes
    if (d.getAttribute('fill') === 'currentColor') {
      d.setAttribute('fill', computed.color);
    }
    if (d.getAttribute('stroke') === 'currentColor') {
      d.setAttribute('stroke', computed.color);
    }

    // For text / tspan elements Recharts sets colour via CSS class, not attribute.
    // Inline the computed fill so the text stays visible in the standalone SVG.
    if (src.tagName === 'text' || src.tagName === 'tspan') {
      const computedFill = computed.fill;
      const hasFill = d.hasAttribute('fill') && d.getAttribute('fill') !== 'none';
      if (!hasFill) {
        // Prefer computed fill; fall back to color (what currentColor resolves to)
        d.setAttribute('fill', computedFill && computedFill !== 'rgba(0, 0, 0, 0)' ? computedFill : computed.color);
      }
    }

    // Strip className — CSS classes are meaningless in a detached SVG
    d.removeAttribute('class');

    for (let i = 0; i < src.children.length; i++) {
      if (dst.children[i]) resolveNode(src.children[i], dst.children[i]);
    }
  }

  resolveNode(svgEl, clone);

  const rect = svgEl.getBoundingClientRect();
  const w = rect.width || svgEl.clientWidth || 400;
  const h = rect.height || svgEl.clientHeight || 200;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  return clone;
}

/**
 * Capture all charts in the DOM.
 * - Recharts charts (has svg.recharts-surface): extract as vector SVG via svg2pdf.
 * - HTML charts (WorkloadHeatmap, etc.): clean html2canvas capture, card stripped.
 */
async function captureCharts(): Promise<Map<string, HTMLCanvasElement | SVGElement>> {
  const chartElements = document.querySelectorAll('[data-chart-id]');
  const capturedCharts = new Map<string, HTMLCanvasElement | SVGElement>();

  for (const element of Array.from(chartElements)) {
    const chartId = element.getAttribute('data-chart-id');
    if (!chartId) continue;

    try {
      // ── SVG path: Recharts renders svg.recharts-surface ──────────────────────
      // We target this specifically — NOT querySelector('svg') which would pick
      // up Lucide icon SVGs (InfoTooltip, badges) before the chart surface.
      const rechartsSVG = element.querySelector('svg.recharts-surface') as SVGElement | null;
      if (rechartsSVG) {
        const prepared = prepareRechartsForPDF(rechartsSVG);
        capturedCharts.set(chartId, prepared);
        console.log(`✓ Captured vector chart: ${chartId}`);
        continue;
      }

      // ── Raster path: HTML-based charts (heatmap, distribution grid, etc.) ───
      const canvas = await html2canvas(element as HTMLElement, {
        scale: 4,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        imageTimeout: 0,
        onclone: (clonedDoc, clonedEl) => {
          clonedDoc.documentElement.classList.remove('dark');
          // Strip card wrapper styling so the chart renders clean (no rounded
          // corners, shadows, backdrop-blur leaking into the PDF image)
          clonedEl.style.borderRadius = '0';
          clonedEl.style.boxShadow = 'none';
          clonedEl.style.border = 'none';
          clonedEl.style.backdropFilter = 'none';
          clonedEl.style.background = '#ffffff';
          clonedEl.style.padding = '12px';
        },
      });

      capturedCharts.set(chartId, canvas);
      console.log(`✓ Captured raster chart: ${chartId}`);
    } catch (error) {
      console.warn(`Failed to capture chart ${chartId}:`, error);
    }
  }

  return capturedCharts;
}

// ── Helper: render one chart block (constrained height, centered) ─────────────
async function addChartBlock(
  generator: PDFGenerator,
  chart: HTMLCanvasElement | SVGElement,
  title: string,
  maxHeight: number
): Promise<void> {
  // Pre-compute chart dimensions BEFORE drawing anything — this lets us call
  // checkPageBreak for the entire block (band + chart) at once, preventing the
  // "orphaned band title on one page, chart on the next" bug.
  let drawW: number;
  let drawH: number;
  if (chart instanceof SVGElement) {
    const svgW = parseFloat(chart.getAttribute('width') || '400');
    const svgH = parseFloat(chart.getAttribute('height') || '200');
    const aspect = svgH / svgW;
    drawW = generator.contentWidth;
    drawH = drawW * aspect;
    if (drawH > maxHeight) { drawH = maxHeight; drawW = drawH / aspect; }
  } else {
    drawW = generator.contentWidth;
    drawH = (chart.height * drawW) / chart.width;
    if (drawH > maxHeight) { drawH = maxHeight; drawW = (chart.width * drawH) / chart.height; }
  }

  const labelBandH = 8;
  // Ensure band + chart fit together — never split the title from its chart
  generator.checkPageBreak(labelBandH + 4 + drawH + 10);

  // Mini chapter-band: lighter variant of addSection() (8mm vs 11mm, 2mm bar vs 3mm)
  generator.doc.setFillColor(245, 247, 255); // softer than indigo-50 — less boxy
  generator.doc.rect(LAYOUT.margin.left, generator.currentY, generator.contentWidth, labelBandH, 'F');
  generator.doc.setFillColor(99, 102, 241);
  generator.doc.rect(LAYOUT.margin.left, generator.currentY, 2, labelBandH, 'F');
  generator.doc.setFontSize(9);
  generator.doc.setFont(FONT.family, 'bold');
  generator.doc.setTextColor(17, 24, 39);
  generator.doc.text(title, LAYOUT.margin.left + 6, generator.currentY + 5.5);
  generator.currentY += labelBandH + 4;

  const xOff = LAYOUT.margin.left + (generator.contentWidth - drawW) / 2;
  if (chart instanceof SVGElement) {
    await generator.doc.svg(chart, { x: xOff, y: generator.currentY, width: drawW, height: drawH });
  } else {
    generator.doc.addImage(chart.toDataURL('image/png'), 'PNG', xOff, generator.currentY, drawW, drawH, undefined, 'NONE');
  }
  generator.currentY += drawH + 10;
}

// ── Helper: draw a premium KPI card ───────────────────────────────────────────
// Clean top-accent-bar design. No sparklines — value + label + subtitle only.
function drawKpiCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string, subtitle: string,
  accent: [number, number, number],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sparkline?: number[]  // kept for API compat, intentionally unused
): void {
  // ── White card with hairline border ──────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'S');

  // ── Top accent bar (2.5mm, full width, rounded top corners only) ─────────
  doc.setFillColor(accent[0], accent[1], accent[2]);
  // Top rounded portion
  doc.roundedRect(x, y, w, 2.5, 1.5, 0, 'F');
  // Fill bottom 1mm of accent bar to make it flush (no gap from rounding)
  doc.rect(x, y + 1.5, w, 1, 'F');

  const padX = x + 5;

  // ── Label — 6pt uppercase, muted, tracked ────────────────────────────────
  doc.setFontSize(6);
  doc.setFont(FONT.family, 'bold');
  doc.setTextColor(156, 163, 175); // gray-400
  doc.setCharSpace(0.8);
  doc.text(label.toUpperCase(), padX, y + 8.5);
  doc.setCharSpace(0); // reset

  // ── Value — 18pt, near-black, anchored so it never overflows ─────────────
  doc.setFontSize(18);
  doc.setFont(FONT.family, 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(value, padX, y + 19, { maxWidth: w - 10 });

  // ── Subtitle — 6.5pt, single line ────────────────────────────────────────
  doc.setFontSize(6.5);
  doc.setFont(FONT.family, 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text(subtitle, padX, y + 25, { maxWidth: w - 10 });
}

function accentForVelocity(v: number): [number, number, number] {
  return v > 0 ? [16, 185, 129] : v < 0 ? [245, 158, 11] : [59, 130, 246];
}
function accentForOnTime(v: number): [number, number, number] {
  return v >= 80 ? [16, 185, 129] : v >= 60 ? [245, 158, 11] : [239, 68, 68];
}
function accentForCFR(v: number): [number, number, number] {
  return v <= 10 ? [16, 185, 129] : v <= 25 ? [245, 158, 11] : [239, 68, 68];
}
function accentForRisk(v: number): [number, number, number] {
  return v <= 30 ? [16, 185, 129] : v <= 60 ? [245, 158, 11] : [239, 68, 68];
}

// ── Native Heatmap Drawing ────────────────────────────────────────────────────

function getHeatmapColorRGB(value: number): [number, number, number] {
  if (value === 0) return [243, 244, 246]; // gray-100
  if (value <= 3)  return [224, 231, 255]; // indigo-100
  if (value <= 6)  return [165, 180, 252]; // indigo-300
  if (value <= 9)  return [99, 102, 241];  // indigo-500
  return [67, 56, 202];                    // indigo-700
}

/**
 * Draw the team workload heatmap natively in jsPDF — no screenshot, vector sharp.
 * Returns the total height consumed (mm) so the caller can advance currentY.
 */
function drawHeatmapNative(
  doc: jsPDF,
  x: number, y: number, w: number,
  data: { users: string[]; days: string[]; data: number[][] }
): number {
  const nDays  = data.days.length;
  const nUsers = data.users.length;
  if (nDays === 0 || nUsers === 0) return 0;

  // Layout constants
  const userColW  = 33;   // left user-name column
  const totalColW = 22;   // right totals column
  const gapL      = 3;    // gap user col → cells
  const gapR      = 3;    // gap cells → totals
  const cellAreaW = w - userColW - gapL - gapR - totalColW;
  const cellGap   = nDays > 14 ? 0.3 : 0.8;
  const cellW     = Math.max(2, (cellAreaW - cellGap * (nDays - 1)) / nDays);
  const cellH     = 6.5;
  const rowGap    = 1;
  const headerH   = 6;

  const cellsX  = x + userColW + gapL;
  const totalX  = x + w - totalColW;

  // ── Day headers ─────────────────────────────────────────────────────────────
  // Show every Nth label when cells are narrow
  const labelEvery = cellW < 4 ? Math.ceil(7 / cellW) : 1;
  doc.setFontSize(5.5);
  doc.setFont(FONT.family, 'normal');
  doc.setTextColor(150, 155, 163);
  data.days.forEach((day, dayIdx) => {
    if (dayIdx % labelEvery !== 0) return;
    let label: string;
    if (day.match(/^\d{4}-\d{2}-\d{2}$/)) {
      label = String(new Date(day + 'T00:00:00').getDate());
    } else {
      label = day.length > 3 ? day.slice(0, 3) : day;
    }
    const cx = cellsX + dayIdx * (cellW + cellGap) + cellW / 2;
    doc.text(label, cx, y + headerH - 1, { align: 'center' });
  });

  // "Total" column header
  doc.setFontSize(5.5);
  doc.setFont(FONT.family, 'bold');
  doc.setTextColor(150, 155, 163);
  doc.text('Total', totalX + (totalColW - 10) / 2 + 2, y + headerH - 1, { align: 'center' });

  // ── Per-user totals ──────────────────────────────────────────────────────────
  const userTotals = data.users.map((_, i) =>
    (data.data[i] ?? []).reduce((sum, v) => sum + v, 0)
  );
  const maxTotal = Math.max(...userTotals, 1);

  // ── User rows ────────────────────────────────────────────────────────────────
  data.users.forEach((user, userIdx) => {
    const rowY = y + headerH + rowGap + userIdx * (cellH + rowGap);

    // User name — truncate to fit column
    doc.setFontSize(7);
    doc.setFont(FONT.family, 'normal');
    doc.setTextColor(55, 65, 81);
    const maxChars = Math.floor(userColW / 1.85);
    const label = user.length > maxChars ? user.slice(0, maxChars - 1) + '\u2026' : user;
    doc.text(label, x, rowY + cellH / 2 + 2.2);

    // Heatmap cells
    (data.data[userIdx] ?? []).forEach((value, dayIdx) => {
      const cx = cellsX + dayIdx * (cellW + cellGap);
      const rgb = getHeatmapColorRGB(value);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      const r = Math.min(0.8, cellW / 4);
      doc.roundedRect(cx, rowY, cellW, cellH, r, r, 'F');
    });

    // Total bar
    const total   = userTotals[userIdx];
    const barMaxW = totalColW - 12;
    const barFill = barMaxW * (total / maxTotal);
    // Track
    doc.setFillColor(237, 238, 242);
    doc.roundedRect(totalX, rowY + 2, barMaxW, cellH - 4, 0.5, 0.5, 'F');
    // Fill
    if (barFill > 0) {
      doc.setFillColor(99, 102, 241);
      doc.roundedRect(totalX, rowY + 2, Math.max(0.8, barFill), cellH - 4, 0.5, 0.5, 'F');
    }
    // Number
    doc.setFontSize(6.5);
    doc.setFont(FONT.family, 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(String(total), totalX + totalColW - 2, rowY + cellH / 2 + 2.2, { align: 'right' });
  });

  // ── Legend ───────────────────────────────────────────────────────────────────
  const legendY = y + headerH + rowGap + nUsers * (cellH + rowGap) + 2;
  const legendSwatches: Array<[number, number, number]> = [
    [243, 244, 246], [224, 231, 255], [165, 180, 252], [99, 102, 241], [67, 56, 202],
  ];
  doc.setFontSize(5.5);
  doc.setFont(FONT.family, 'normal');
  doc.setTextColor(150, 155, 163);
  doc.text('Less', x, legendY + 3.2);
  let lx = x + 8;
  legendSwatches.forEach(rgb => {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(lx, legendY, 4, 4, 0.5, 0.5, 'F');
    lx += 5;
  });
  doc.text('More', lx + 1, legendY + 3.2);

  return headerH + rowGap + nUsers * (cellH + rowGap) + 9; // total height including legend
}

// ── Native Task Distribution Drawing ─────────────────────────────────────────

const TASK_DIST_COLORS: Record<string, [number, number, number]> = {
  Features:    [59, 130, 246],
  Bugs:        [239, 68, 68],
  Chores:      [245, 158, 11],
  Maintenance: [139, 92, 246],
  'Tech Debt': [99, 102, 241],
  'New Value': [16, 185, 129],
};
const TASK_DIST_DEFAULT: [number, number, number] = [107, 114, 128];

/**
 * Draw the task distribution chart natively in jsPDF — stacked bar + legend.
 * Returns total height consumed (mm).
 */
function drawTaskDistributionNative(
  doc: jsPDF,
  x: number, y: number, w: number,
  data: { labels: string[]; datasets: Array<{ label: string; data: number[]; color: string }> }
): number {
  const segments = data.labels
    .map((label, idx) => ({
      name: label,
      value: data.datasets[0]?.data[idx] ?? 0,
      rgb: TASK_DIST_COLORS[label] ?? TASK_DIST_DEFAULT,
    }))
    .filter(s => s.value > 0);

  if (segments.length === 0) return 0;

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let curY = y;

  // ── Hero total ───────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont(FONT.family, 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(String(total), x, curY + 8);

  doc.setFontSize(6.5);
  doc.setFont(FONT.family, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Total Tasks', x, curY + 14);

  curY += 18;

  // ── Stacked horizontal bar — flat rects, zero rounding, zero artifacts ───
  const barH = 4;
  // Gray track underneath (gives visual base)
  doc.setFillColor(237, 238, 242);
  doc.rect(x, curY, w, barH, 'F');
  // Segments — last one forced to exact right edge to prevent gap/overflow
  let barX = x;
  segments.forEach((seg, i) => {
    const isLast = i === segments.length - 1;
    const segW = isLast
      ? Math.max(0.1, x + w - barX)        // fill exactly to right edge
      : Math.max(0.1, (seg.value / total) * w);
    doc.setFillColor(seg.rgb[0], seg.rgb[1], seg.rgb[2]);
    doc.rect(barX, curY, segW, barH, 'F');
    barX += isLast ? 0 : segW;
  });

  curY += barH + 6;

  // ── Legend rows ───────────────────────────────────────────────────────────
  segments.forEach(seg => {
    const pct = ((seg.value / total) * 100).toFixed(1);

    // Color dot
    doc.setFillColor(seg.rgb[0], seg.rgb[1], seg.rgb[2]);
    doc.circle(x + 2.5, curY + 2.5, 1.8, 'F');

    // Category name
    doc.setFontSize(8);
    doc.setFont(FONT.family, 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(seg.name, x + 7, curY + 4.5);

    // Count
    doc.setFontSize(8);
    doc.setFont(FONT.family, 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(String(seg.value), x + w * 0.66, curY + 4.5);

    // Percentage
    doc.setFontSize(7.5);
    doc.setFont(FONT.family, 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`${pct}%`, x + w, curY + 4.5, { align: 'right' });

    curY += 7.5;
  });

  return curY - y;
}

/**
 * Enhanced Manager Report PDF with Charts
 * Implements enterprise layout optimized per report type.
 * Org reports: KPI cards → CFD → WipTrend+TaskDist (2-col) → Heatmap → Text sections
 * Other reports: legacy single-column chart sequence
 */
export async function generateManagerReportPDF(
  report: {
    summary: string;
    sections: Array<{ title: string; content: string }>;
    type: string;
    created_at?: string;
    cached?: boolean;
    chartData?: {
      pulse?: {
        velocityRate: { value: number; sparkline: number[] };
        cycleTime: { value: number; sparkline: number[] };
        onTimeDelivery: { value: number; sparkline: number[] };
        riskScore: { value: number; sparkline: number[] };
        changeFailureRate?: { value: number; sparkline: number[] };
      };
      heatmap?: { users: string[]; days: string[]; data: number[][] };
      investment?: {
        labels: string[];
        datasets: Array<{ label: string; data: number[]; color: string }>;
      };
    };
  },
  organizationName: string,
  period: string,
  reportTypeName: string,
  periodType?: 'week' | 'month' | 'quarter'
): Promise<void> {
  // Calculate partial period progress for visual indicators
  const partialInfo = (() => {
    if (!periodType) return null;
    const now = new Date();
    if (periodType === 'week') {
      const dow = now.getDay();
      const elapsed = dow === 0 ? 7 : dow;
      return { elapsed, total: 7, isPartial: elapsed < 7 };
    } else if (periodType === 'month') {
      const elapsed = now.getDate();
      const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return { elapsed, total, isPartial: elapsed < total };
    } else if (periodType === 'quarter') {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const qStart = new Date(now.getFullYear(), qStartMonth, 1);
      const qEnd = new Date(now.getFullYear(), qStartMonth + 3, 0);
      const total = Math.floor((qEnd.getTime() - qStart.getTime()) / 86400000) + 1;
      const elapsed = Math.floor((now.getTime() - qStart.getTime()) / 86400000) + 1;
      return { elapsed, total, isPartial: elapsed < total };
    }
    return null;
  })();
  // Step 0: Load Inter font (fetches once, cached for all subsequent PDFs)
  const _tmpDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadInterFont(_tmpDoc); // sets FONT.family = 'Inter' on success

  // Step 1: Capture all charts
  console.log('📊 Capturing charts for PDF...');
  const charts = await captureCharts();
  console.log(`✓ Captured ${charts.size} charts`);

  // Step 2: Generate PDF
  const generator = new PDFGenerator();

  // ========== COVER PAGE ==========
  generator.addCoverPage(
    reportTypeName || 'Management Intelligence Report',
    organizationName,
    period,
    report.type
  );

  const data: ManagerReportData = {
    type: 'manager',
    title: reportTypeName,
    organizationName,
    period,
    reportType: report.type,
    summary: report.summary,
    sections: report.sections,
    generatedAt: report.created_at,
    cached: report.cached,
  };

  const partialBadge = partialInfo?.isPartial ? '  [PARTIAL]' : '';
  const metadata: BaseReportMetadata = {
    title: data.title || 'Management Intelligence Report',
    subtitle: `${data.organizationName} — ${data.period}${partialBadge}`,
    generatedAt: data.generatedAt,
    cached: data.cached,
  };

  generator.addHeader(metadata);
  generator.addFooter();
  generator.setRunningHeader(data.title || 'Management Report', data.organizationName);

  // ========== EXECUTIVE SUMMARY ==========
  generator.addSummaryBox('Executive Summary', data.summary);

  // ========== CHART EXTRACTION ==========
  const realCfdChart  = charts.get('real-cfd-area');
  const wipTrendChart = charts.get('wip-trend-chart');
  const taskDistChart = charts.get('task-distribution');
  const heatmapChart  = charts.get('workload-heatmap');
  // Legacy chart IDs (bottleneck / user performance reports)
  const investmentChart = charts.get('investment-profile');
  const throughputChart = charts.get('throughput-trend');
  const radarChart      = charts.get('radar-metrics');
  const cfdChart        = charts.get('cfd-area');
  const cycleTimeChart  = charts.get('scatter-cycle');
  const burndownChart   = charts.get('burndown-predictive');

  const reportNameLower = reportTypeName.toLowerCase();
  const isOrgReport = reportNameLower.includes('weekly')
                   || reportNameLower.includes('monthly')
                   || reportNameLower.includes('quarterly');
  const isBottleneckReport = reportNameLower.includes('bottleneck');

  if (isOrgReport) {
    // ── 1. KPI Cards — 3+2 grid layout ───────────────────────────────────────
    const pulse = report.chartData?.pulse;
    if (pulse) {
      const gap   = 4;
      const cardH = 28;

      // Section label
      generator.doc.setFontSize(8);
      generator.doc.setFont(FONT.family, 'bold');
      generator.doc.setTextColor(156, 163, 175); // muted gray, not blue
      generator.doc.text('KEY METRICS', LAYOUT.margin.left, generator.currentY);
      generator.currentY += 5;

      // ── Row 1: 3 equal cards ─────────────────────────────────────────────
      const row1W = (generator.contentWidth - gap * 2) / 3;
      generator.checkPageBreak(cardH + gap + cardH + 12);
      const row1Y = generator.currentY;
      const startX = LAYOUT.margin.left;

      drawKpiCard(generator.doc, startX,                    row1Y, row1W, cardH,
        'Velocity Rate',
        `${pulse.velocityRate.value > 0 ? '+' : ''}${pulse.velocityRate.value}%`,
        'tasks / week delta',
        accentForVelocity(pulse.velocityRate.value));

      drawKpiCard(generator.doc, startX + row1W + gap,      row1Y, row1W, cardH,
        'On-Time Delivery',
        `${pulse.onTimeDelivery.value}%`,
        '% tasks on schedule',
        accentForOnTime(pulse.onTimeDelivery.value));

      drawKpiCard(generator.doc, startX + (row1W + gap) * 2, row1Y, row1W, cardH,
        'Cycle Time',
        `${pulse.cycleTime.value}d`,
        'avg days per task',
        [59, 130, 246]);

      generator.currentY += cardH + gap;

      // ── Row 2: 2 wider cards ─────────────────────────────────────────────
      const row2W = (generator.contentWidth - gap) / 2;
      const row2Y = generator.currentY;

      drawKpiCard(generator.doc, startX,            row2Y, row2W, cardH,
        'Change Failure Rate',
        `${pulse.changeFailureRate?.value ?? 0}%`,
        'failed deployments',
        accentForCFR(pulse.changeFailureRate?.value ?? 0));

      drawKpiCard(generator.doc, startX + row2W + gap, row2Y, row2W, cardH,
        'Risk Score',
        `${pulse.riskScore.value}`,
        'composite risk index',
        accentForRisk(pulse.riskScore.value));

      generator.currentY += cardH + 10;

      // ── Period progress bar — slim, unobtrusive ───────────────────────────
      // Reduced to 3mm so it doesn't push the CFD off-page.
      if (partialInfo) {
        const barW = generator.contentWidth;
        const barH = 3;
        const fillW = Math.max(3, Math.round(barW * (partialInfo.elapsed / partialInfo.total)));
        const pct = Math.round((partialInfo.elapsed / partialInfo.total) * 100);

        generator.checkPageBreak(12);

        const fillColor: [number, number, number] = partialInfo.isPartial ? [99, 102, 241] : [16, 185, 129];
        const trackColor: [number, number, number] = [229, 231, 235];

        // Single-line label: "Day 1 / 7  ·  14% elapsed" — left to right
        generator.doc.setFontSize(6.5);
        generator.doc.setFont(FONT.family, 'bold');
        generator.doc.setTextColor(...fillColor);
        generator.doc.text(
          `Day ${partialInfo.elapsed} / ${partialInfo.total}`,
          LAYOUT.margin.left,
          generator.currentY + 3.5
        );
        generator.doc.setFont(FONT.family, 'normal');
        generator.doc.setTextColor(150, 155, 163);
        generator.doc.text(
          `${pct}% of period elapsed`,
          LAYOUT.margin.left + barW,
          generator.currentY + 3.5,
          { align: 'right' }
        );

        generator.currentY += 6;

        // Track + fill — slim pill
        generator.doc.setFillColor(...trackColor);
        generator.doc.roundedRect(LAYOUT.margin.left, generator.currentY, barW, barH, 1, 1, 'F');
        generator.doc.setFillColor(...fillColor);
        generator.doc.roundedRect(LAYOUT.margin.left, generator.currentY, fillW, barH, 1, 1, 'F');

        generator.currentY += barH + 8;
      } else {
        generator.currentY += 4;
      }
    }

    // ── 2. CFD — full width ───────────────────────────────────────────────────
    if (realCfdChart) {
      await addChartBlock(generator, realCfdChart, 'Cumulative Flow Diagram', 74);
    }

    // ── 3. WipTrend (left) + TaskDistribution native (right) — 2 columns ────────
    const taskDistData = report.chartData?.investment;
    const hasLeft  = !!wipTrendChart;
    const hasRight = !!taskDistData && taskDistData.labels.length > 0;

    if (hasLeft || hasRight) {
      const colW   = (generator.contentWidth - 8) / 2;
      const leftX  = LAYOUT.margin.left;
      const rightX = LAYOUT.margin.left + colW + 8;

      // Estimate right column height (native) for page break decision
      const nRightSegments = hasRight
        ? taskDistData!.labels.filter((_, i) => (taskDistData!.datasets[0]?.data[i] ?? 0) > 0).length
        : 0;
      const estRightH = hasRight ? 18 + 11 + nRightSegments * 7.5 : 0; // hero + bar + rows

      // Estimate left column height from SVG dimensions
      const maxColH = 78;
      let leftDrawH = 0;
      let leftDrawW = colW;
      if (hasLeft && wipTrendChart) {
        const svgW = parseFloat(wipTrendChart instanceof SVGElement
          ? (wipTrendChart.getAttribute('width') || '400')
          : String((wipTrendChart as HTMLCanvasElement).width));
        const svgH = parseFloat(wipTrendChart instanceof SVGElement
          ? (wipTrendChart.getAttribute('height') || '200')
          : String((wipTrendChart as HTMLCanvasElement).height));
        leftDrawH = Math.min((svgH / svgW) * colW, maxColH);
        leftDrawW = leftDrawH < (svgH / svgW) * colW ? (svgW / svgH) * leftDrawH : colW;
      }
      const rowH = Math.max(leftDrawH, estRightH, 40);

      generator.checkPageBreak(rowH + 22);

      // Mini-band labels for each column — same system as addChartBlock
      const colLabelH = 8;
      generator.doc.setFontSize(9);
      generator.doc.setFont(FONT.family, 'bold');
      generator.doc.setTextColor(17, 24, 39);
      if (hasLeft) {
        generator.doc.setFillColor(245, 247, 255);
        generator.doc.rect(leftX, generator.currentY, colW, colLabelH, 'F');
        generator.doc.setFillColor(99, 102, 241);
        generator.doc.rect(leftX, generator.currentY, 2, colLabelH, 'F');
        generator.doc.text('Throughput Trend', leftX + 6, generator.currentY + 5.5);
      }
      if (hasRight) {
        generator.doc.setFillColor(245, 247, 255);
        generator.doc.rect(rightX, generator.currentY, colW, colLabelH, 'F');
        generator.doc.setFillColor(99, 102, 241);
        generator.doc.rect(rightX, generator.currentY, 2, colLabelH, 'F');
        generator.doc.text('Task Distribution', rightX + 6, generator.currentY + 5.5);
      }
      generator.currentY += colLabelH + 4;

      // Left: WipTrend chart (SVG or canvas)
      if (hasLeft && wipTrendChart) {
        if (wipTrendChart instanceof SVGElement) {
          await generator.doc.svg(wipTrendChart, { x: leftX, y: generator.currentY, width: leftDrawW, height: leftDrawH });
        } else {
          generator.doc.addImage((wipTrendChart as HTMLCanvasElement).toDataURL('image/png'), 'PNG',
            leftX, generator.currentY, leftDrawW, leftDrawH, undefined, 'NONE');
        }
      }

      // Right: TaskDistribution — native vector, no screenshot
      if (hasRight && taskDistData) {
        drawTaskDistributionNative(generator.doc, rightX, generator.currentY, colW, taskDistData);
      }

      generator.currentY += rowH + 10;
    }

    // ── 4. Heatmap — native vector drawing (no screenshot) ───────────────────
    const heatmapData = report.chartData?.heatmap;
    if (heatmapData && heatmapData.users.length > 0) {
      const cellH = 6.5, rowGap = 1, headerH = 6;
      const estH = headerH + rowGap + heatmapData.users.length * (cellH + rowGap) + 25;
      generator.checkPageBreak(estH);
      // Mini-band label — consistent with addChartBlock style
      const hmLabelH = 8;
      generator.doc.setFillColor(245, 247, 255);
      generator.doc.rect(LAYOUT.margin.left, generator.currentY, generator.contentWidth, hmLabelH, 'F');
      generator.doc.setFillColor(99, 102, 241);
      generator.doc.rect(LAYOUT.margin.left, generator.currentY, 2, hmLabelH, 'F');
      generator.doc.setFontSize(9);
      generator.doc.setFont(FONT.family, 'bold');
      generator.doc.setTextColor(17, 24, 39);
      generator.doc.text('Team Workload Heatmap', LAYOUT.margin.left + 6, generator.currentY + 5.5);
      generator.currentY += hmLabelH + 4;
      const drawn = drawHeatmapNative(
        generator.doc,
        LAYOUT.margin.left, generator.currentY, generator.contentWidth,
        heatmapData
      );
      generator.currentY += drawn + 8;
    } else if (heatmapChart) {
      await addChartBlock(generator, heatmapChart, 'Team Workload Heatmap', 72);
    }

  } else {
    // ── Legacy single-column sequence (bottleneck, user performance, etc.) ───
    const chartSequence: Array<{ chart: HTMLCanvasElement | SVGElement; title: string; maxHeight: number }> = [
      investmentChart && { chart: investmentChart, title: 'Investment Profile', maxHeight: 75 },
      cycleTimeChart  && { chart: cycleTimeChart,  title: 'Cycle Time Analysis', maxHeight: 90 },
      radarChart      && { chart: radarChart,      title: 'Code Review Metrics', maxHeight: 90 },
      throughputChart && { chart: throughputChart, title: 'Throughput Trend', maxHeight: 90 },
      burndownChart   && { chart: burndownChart,   title: 'Predictive Burndown', maxHeight: 100 },
      !isBottleneckReport && heatmapChart && { chart: heatmapChart, title: 'Workload Heatmap', maxHeight: 85 },
      cfdChart        && { chart: cfdChart,        title: 'Cumulative Flow Diagram', maxHeight: 110 },
      realCfdChart    && { chart: realCfdChart,    title: 'Real-Time Cumulative Flow', maxHeight: 110 },
    ].filter((item): item is { chart: HTMLCanvasElement | SVGElement; title: string; maxHeight: number } => Boolean(item));

    for (const entry of chartSequence) {
      await addChartBlock(generator, entry.chart, entry.title, entry.maxHeight);
    }
  }

  // ========== TEXT SECTIONS ==========
  for (const section of data.sections) {
    generator.addSection(section.title, section.content);
  }

  // ========== END OF REPORT MARKER ==========
  generator.checkPageBreak(18);
  generator.currentY += 10;
  generator.doc.setDrawColor(220, 222, 228);
  generator.doc.setLineWidth(0.3);
  const endLineX1 = LAYOUT.margin.left + generator.contentWidth * 0.25;
  const endLineX2 = LAYOUT.margin.left + generator.contentWidth * 0.75;
  generator.doc.line(endLineX1, generator.currentY, endLineX2, generator.currentY);
  generator.currentY += 4;
  generator.doc.setFontSize(7.5);
  generator.doc.setFont(FONT.family, 'normal');
  generator.doc.setTextColor(180, 183, 190);
  generator.doc.text(
    'End of Report  ·  Generated by Aether AI',
    LAYOUT.margin.left + generator.contentWidth / 2,
    generator.currentY,
    { align: 'center' }
  );

  // Download
  const filename = `Aether_${reportTypeName.replace(/\s+/g, '_')}_${period}_${Date.now()}.pdf`;
  generator.download(filename);
  console.log(`✓ PDF generated: ${filename}`);
}

export function generateTaskReportPDF(
  report: {
    summary: string;
    sections: Array<{ title: string; content: string }>;
    cached?: boolean;
    timestamp?: string;
  },
  taskTitle: string
): void {
  const generator = new PDFGenerator();

  const data: TaskReportData = {
    type: 'task',
    title: 'Task Report',
    taskTitle,
    summary: report.summary,
    sections: report.sections,
    generatedAt: report.timestamp,
    cached: report.cached,
  };

  generator.generateTaskReport(data);

  const filename = `Aether_Task_Report_${Date.now()}.pdf`;
  generator.download(filename);
}

export function generateCodeAnalysisPDF(
  analysis: {
    summary: string;
    score: string;
    issues: Array<{
      severity: 'high' | 'medium' | 'low';
      title: string;
      file: string;
      line: number;
    }>;
    cached?: boolean;
    timestamp?: string;
  },
  commitSha: string
): void {
  const generator = new PDFGenerator();

  const data: CodeAnalysisData = {
    type: 'code_analysis',
    title: 'Security Analysis',
    commitSha,
    summary: analysis.summary,
    score: analysis.score,
    issues: analysis.issues,
    generatedAt: analysis.timestamp,
    cached: analysis.cached,
  };

  generator.generateCodeAnalysis(data);

  const filename = `Aether_Security_Analysis_${commitSha.substring(0, 8)}_${Date.now()}.pdf`;
  generator.download(filename);
}

export function generateCommitExplanationPDF(
  explanation: {
    sha: string;
    taskId: string;
    taskTitle: string;
    readableId: string;
    explanation: string;
    howItFulfillsTask: string;
    technicalDetails: string;
    remainingWork: string[];
    cached?: boolean;
    timestamp?: string;
  }
): void {
  const generator = new PDFGenerator();

  const data: CommitExplanationData = {
    type: 'commit_explanation',
    title: 'Commit Explanation',
    commitSha: explanation.sha,
    taskTitle: explanation.taskTitle,
    readableId: explanation.readableId,
    explanation: explanation.explanation,
    howItFulfillsTask: explanation.howItFulfillsTask,
    technicalDetails: explanation.technicalDetails,
    remainingWork: explanation.remainingWork,
    generatedAt: explanation.timestamp,
    cached: explanation.cached,
  };

  generator.generateCommitExplanation(data);

  const filename = `Aether_Commit_${explanation.sha.substring(0, 8)}_${Date.now()}.pdf`;
  generator.download(filename);
}
