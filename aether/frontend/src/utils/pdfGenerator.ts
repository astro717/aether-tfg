/**
 * PDF Generator Utility
 * High-fidelity PDF generation for AI reports with professional design
 * NOW with multi-chart capture for enterprise visualizations
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Aether color palette (matching the brand)
const COLORS = {
  primary: {
    purple: [99, 102, 241], // #6366f1
    blue: [59, 130, 246], // #3b82f6
    indigo: [139, 92, 246], // #8b5cf6
  },
  semantic: {
    success: [34, 197, 94], // #22c55e
    warning: [251, 191, 36], // #fbbf24
    danger: [239, 68, 68], // #ef4444
  },
  neutral: {
    dark: [31, 41, 55], // #1f2937
    medium: [107, 114, 128], // #6b7280
    light: [243, 244, 246], // #f3f4f6
  },
} as const;

// Typography hierarchy (industry standard sizes)
const FONTS = {
  h1: { size: 16, weight: 'bold' as const },
  h2: { size: 14, weight: 'bold' as const },
  h3: { size: 12, weight: 'bold' as const },
  body: { size: 10, weight: 'normal' as const },
  small: { size: 9, weight: 'normal' as const },
  caption: { size: 8, weight: 'normal' as const },
} as const;

// Layout constants (in mm)
const LAYOUT = {
  margin: {
    top: 25,
    bottom: 25,
    left: 20,
    right: 20,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
  spacing: {
    section: 8,
    paragraph: 5,
    small: 3,
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
  readableId: number;
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
  private doc: jsPDF;
  public currentY: number; // Made public for external layout calculations
  private pageWidth: number;
  private pageHeight: number;
  public contentWidth: number; // Made public for external layout calculations
  private pageNumber: number;

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
   * Add a new page with footer
   */
  private addPage(): void {
    this.doc.addPage();
    this.pageNumber++;
    this.currentY = LAYOUT.margin.top;
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
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0); // Black
      this.doc.text('aether.', logoX, logoY + 8);
    } catch (error) {
      console.warn('Failed to add logo', error);
    }

    // Report title and metadata (right side)
    const metadataX = logoX + logoSize + 10;

    this.doc.setFontSize(FONTS.h1.size);
    this.doc.setFont('helvetica', FONTS.h1.weight);
    this.doc.setTextColor(...COLORS.neutral.dark);
    this.doc.text(metadata.title, metadataX, logoY + 8, { maxWidth: this.pageWidth - metadataX - LAYOUT.margin.right });

    if (metadata.subtitle) {
      this.doc.setFontSize(FONTS.small.size);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.neutral.medium);
      this.doc.text(metadata.subtitle, metadataX, logoY + 14);
    }

    // Generated date
    const generatedText = metadata.generatedAt || new Date().toLocaleString();
    const cachedBadge = metadata.cached ? ' [CACHED]' : '';
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
    this.doc.setFont('helvetica', 'normal');
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
    const boxHeight = this.calculateTextHeight(content, this.contentWidth - 10, FONTS.body.size) + 15;

    this.doc.setFillColor(...COLORS.neutral.light);
    this.doc.roundedRect(
      LAYOUT.margin.left,
      boxY,
      this.contentWidth,
      boxHeight,
      2,
      2,
      'F'
    );

    // Title
    this.doc.setFontSize(FONTS.h3.size);
    this.doc.setFont('helvetica', FONTS.h3.weight);
    this.doc.setTextColor(...COLORS.primary.indigo);
    this.doc.text(title, LAYOUT.margin.left + 5, boxY + 7);

    // Content
    this.doc.setFontSize(FONTS.body.size);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...COLORS.neutral.dark);

    const lines = this.doc.splitTextToSize(content, this.contentWidth - 10);
    this.doc.text(lines, LAYOUT.margin.left + 5, boxY + 14);

    this.currentY = boxY + boxHeight + LAYOUT.spacing.section;
  }

  /**
   * Add a section with title and content
   */
  public addSection(title: string, content: string): void {
    this.checkPageBreak(30);

    // Section title with accent
    this.doc.setFontSize(FONTS.h2.size);
    this.doc.setFont('helvetica', FONTS.h2.weight);
    this.doc.setTextColor(...COLORS.primary.blue);

    // Add decorative bullet
    this.doc.setFillColor(...COLORS.primary.purple);
    this.doc.circle(LAYOUT.margin.left + 2, this.currentY - 1.5, 1.5, 'F');

    this.doc.text(title, LAYOUT.margin.left + 7, this.currentY);
    this.currentY += LAYOUT.spacing.paragraph;

    // Section content
    this.doc.setFontSize(FONTS.body.size);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...COLORS.neutral.dark);

    const lines = this.doc.splitTextToSize(content, this.contentWidth - 7);

    // Handle page breaks within content
    for (const line of lines) {
      this.checkPageBreak(6);
      this.doc.text(line, LAYOUT.margin.left + 7, this.currentY);
      this.currentY += 5;
    }

    this.currentY += LAYOUT.spacing.section;
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
    this.doc.setFont('helvetica', 'bold');
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
    this.doc.setFont('helvetica', FONTS.h2.weight);
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
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...COLORS.neutral.dark);
      this.doc.text(issue.title, LAYOUT.margin.left + pillWidth + 2, issueY);
      this.currentY += 6;

      // File and line info
      this.doc.setFont('helvetica', 'normal');
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
      this.doc.setFont('helvetica', FONTS.h3.weight);
      this.doc.setTextColor(...COLORS.primary.blue);
      this.doc.text(title, LAYOUT.margin.left, this.currentY);
      this.currentY += 8;
    }

    // Add image
    const imgData = canvas.toDataURL('image/png');
    this.doc.addImage(
      imgData,
      'PNG',
      LAYOUT.margin.left,
      this.currentY,
      imgWidth,
      imgHeight,
      undefined,
      'FAST'
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
    this.doc.setFont('helvetica', FONTS.h3.weight);
    this.doc.setTextColor(...COLORS.primary.blue);
    this.doc.text(title, x, y);

    // Add image
    const imgData = canvas.toDataURL('image/png');
    this.doc.addImage(imgData, 'PNG', x, y + 8, width, imgHeight, undefined, 'FAST');
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
    this.addSummaryBox('Executive Summary', this.cleanMarkdown(data.summary));

    // Sections
    for (const section of data.sections) {
      this.addSection(section.title, this.cleanMarkdown(section.content));
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
    this.addSummaryBox('Summary', this.cleanMarkdown(data.summary));

    // Sections
    for (const section of data.sections) {
      this.addSection(section.title, this.cleanMarkdown(section.content));
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
      this.cleanMarkdown(data.summary)
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
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...COLORS.neutral.medium);
    this.doc.text(`Commit SHA: ${data.commitSha}`, LAYOUT.margin.left, this.currentY);
    this.currentY += LAYOUT.spacing.section;

    // Explanation
    this.addSummaryBox('What This Commit Does', this.cleanMarkdown(data.explanation));

    // How It Fulfills Task
    if (data.howItFulfillsTask) {
      this.addSection('How It Fulfills the Task', this.cleanMarkdown(data.howItFulfillsTask));
    }

    // Technical Details
    this.addSection('Technical Details', this.cleanMarkdown(data.technicalDetails));

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
 * Capture all charts in the DOM as canvas elements
 * Uses html2canvas to convert chart components to images
 */
async function captureCharts(): Promise<Map<string, HTMLCanvasElement>> {
  const chartElements = document.querySelectorAll('[data-chart-id]');
  const capturedCharts = new Map<string, HTMLCanvasElement>();

  for (const element of Array.from(chartElements)) {
    const chartId = element.getAttribute('data-chart-id');
    if (!chartId) continue;

    try {
      // Capture with high quality settings
      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2, // High DPI for crisp charts
        backgroundColor: '#ffffff', // White background for PDF
        logging: false,
        useCORS: true,
      });

      capturedCharts.set(chartId, canvas);
      console.log(`✓ Captured chart: ${chartId}`);
    } catch (error) {
      console.warn(`Failed to capture chart ${chartId}:`, error);
    }
  }

  return capturedCharts;
}

/**
 * Enhanced Manager Report PDF with Charts
 * Implements 3-page enterprise layout:
 * - Page 1: Executive Summary + Key Metrics (Big Numbers)
 * - Page 2: Detailed Analysis + Charts (Investment & DORA)
 * - Page 3: Predictions + Charts (CFD & Bottlenecks)
 */
export async function generateManagerReportPDF(
  report: {
    summary: string;
    sections: Array<{ title: string; content: string }>;
    type: string;
    created_at?: string;
    cached?: boolean;
  },
  organizationName: string,
  period: string,
  reportTypeName: string
): Promise<void> {
  // Step 1: Capture all charts
  console.log('📊 Capturing charts for PDF...');
  const charts = await captureCharts();
  console.log(`✓ Captured ${charts.size} charts`);

  // Step 2: Generate PDF with charts
  const generator = new PDFGenerator();

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

  // Generate report with chart integration
  const metadata: BaseReportMetadata = {
    title: data.title || 'Management Intelligence Report',
    subtitle: `${data.organizationName} - ${data.period}`,
    generatedAt: data.generatedAt,
    cached: data.cached,
  };

  generator.addHeader(metadata);
  generator.addFooter();

  // ========== PAGE 1: EXECUTIVE SUMMARY & KEY METRICS ==========
  generator.addSummaryBox('Executive Summary', generator.cleanMarkdown(data.summary));

  // Define compact chart width (half page for side-by-side)
  const halfWidth = (generator.contentWidth - 5) / 2; // 5mm gap between charts
  const leftX = LAYOUT.margin.left;
  const rightX = LAYOUT.margin.left + halfWidth + 5;

  // Get all available charts
  const doraChart = charts.get('dora-metrics');
  const investmentChart = charts.get('investment-profile');
  const throughputChart = charts.get('throughput-trend');
  const radarChart = charts.get('radar-metrics');
  const cfdChart = charts.get('cfd-area');
  const cycleTimeChart = charts.get('scatter-cycle');

  // ========== PAGE 1 (continued): DORA Metrics (if available) ==========
  if (doraChart) {
    generator.checkPageBreak(65);
    // DORA gets full width as it's a panel with multiple metrics
    generator.addChartImage(doraChart, 'Key Performance Indicators', generator.contentWidth);
  }

  // ========== PAGE 2: SIDE-BY-SIDE CHARTS ==========
  // Try to fit 2 charts per row for compact layout

  // Row 1: Investment + Throughput OR Cycle Time
  if (investmentChart || throughputChart || cycleTimeChart) {
    generator.checkPageBreak(75);
    const startY = generator.currentY;

    if (investmentChart && throughputChart) {
      // Two charts side by side
      generator.addChartImageAtPosition(investmentChart, 'Investment Profile', leftX, startY, halfWidth);
      generator.addChartImageAtPosition(throughputChart, 'Throughput Trend', rightX, startY, halfWidth);

      // Calculate max height and move cursor
      const investmentHeight = (investmentChart.height * halfWidth) / investmentChart.width;
      const throughputHeight = (throughputChart.height * halfWidth) / throughputChart.width;
      generator.currentY = startY + Math.max(investmentHeight, throughputHeight) + 15;
    } else if (investmentChart && cycleTimeChart) {
      // Two charts side by side
      generator.addChartImageAtPosition(investmentChart, 'Investment Profile', leftX, startY, halfWidth);
      generator.addChartImageAtPosition(cycleTimeChart, 'Cycle Time Analysis', rightX, startY, halfWidth);

      // Calculate max height and move cursor
      const investmentHeight = (investmentChart.height * halfWidth) / investmentChart.width;
      const cycleHeight = (cycleTimeChart.height * halfWidth) / cycleTimeChart.width;
      generator.currentY = startY + Math.max(investmentHeight, cycleHeight) + 15;
    } else if (investmentChart) {
      // Single chart, use half width for consistency
      generator.addChartImage(investmentChart, 'Investment Profile', halfWidth);
    } else if (throughputChart) {
      generator.addChartImage(throughputChart, 'Throughput Trend', halfWidth);
    } else if (cycleTimeChart) {
      generator.addChartImage(cycleTimeChart, 'Cycle Time Analysis', halfWidth);
    }
  }

  // Row 2: Radar + CFD OR remaining charts
  if (radarChart || cfdChart) {
    generator.checkPageBreak(75);
    const startY = generator.currentY;

    if (radarChart && cfdChart) {
      // Two charts side by side
      generator.addChartImageAtPosition(radarChart, 'Code Review Metrics', leftX, startY, halfWidth);
      generator.addChartImageAtPosition(cfdChart, 'Cumulative Flow Diagram', rightX, startY, halfWidth);

      // Calculate max height and move cursor
      const radarHeight = (radarChart.height * halfWidth) / radarChart.width;
      const cfdHeight = (cfdChart.height * halfWidth) / cfdChart.width;
      generator.currentY = startY + Math.max(radarHeight, cfdHeight) + 15;
    } else if (radarChart) {
      generator.addChartImage(radarChart, 'Code Review Metrics', halfWidth);
    } else if (cfdChart) {
      // CFD is complex, give it more space
      generator.addChartImage(cfdChart, 'Cumulative Flow Diagram', generator.contentWidth);
    }
  }

  // Row 3: Remaining charts (Throughput or Cycle Time if not placed yet)
  if (!investmentChart && throughputChart && cycleTimeChart) {
    generator.checkPageBreak(75);
    const startY = generator.currentY;
    generator.addChartImageAtPosition(throughputChart, 'Throughput Trend', leftX, startY, halfWidth);
    generator.addChartImageAtPosition(cycleTimeChart, 'Cycle Time Analysis', rightX, startY, halfWidth);

    const throughputHeight = (throughputChart.height * halfWidth) / throughputChart.width;
    const cycleHeight = (cycleTimeChart.height * halfWidth) / cycleTimeChart.width;
    generator.currentY = startY + Math.max(throughputHeight, cycleHeight) + 15;
  } else if (!investmentChart && !throughputChart && cycleTimeChart) {
    generator.addChartImage(cycleTimeChart, 'Cycle Time Analysis', halfWidth);
  } else if (!investmentChart && !cycleTimeChart && throughputChart) {
    generator.addChartImage(throughputChart, 'Throughput Trend', halfWidth);
  }

  // ========== PAGE 3: TEXT SECTIONS ==========
  // Add text sections after charts
  for (const section of data.sections) {
    generator.addSection(section.title, generator.cleanMarkdown(section.content));
  }

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
    readableId: number;
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
