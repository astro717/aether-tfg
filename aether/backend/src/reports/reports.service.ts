import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser } from 'puppeteer';

interface PreviewEntry {
  data: Record<string, unknown>;
  expiresAt: number;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly store = new Map<string, PreviewEntry>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(private readonly config: ConfigService) {
    // Purge expired entries every minute
    setInterval(() => this.purgeExpired(), 60_000);
  }

  // ── Store / retrieve preview data ──────────────────────────────────────────

  storePreview(data: Record<string, unknown>): string {
    const token = crypto.randomUUID();
    this.store.set(token, { data, expiresAt: Date.now() + this.TTL_MS });
    return token;
  }

  getPreviewData(token: string): Record<string, unknown> | null {
    const entry = this.store.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(token);
      return null;
    }
    return entry.data;
  }

  // ── PDF generation via Puppeteer ───────────────────────────────────────────

  async generatePDF(previewToken: string): Promise<Buffer> {
    const entry = this.store.get(previewToken);
    if (!entry || Date.now() > entry.expiresAt) {
      throw new NotFoundException('Preview token not found or expired');
    }

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const url = `${frontendUrl}/reports/print-preview?token=${previewToken}`;

    this.logger.log(`Generating PDF → ${url}`);

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    let browser: Browser | undefined;

    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
          '--disable-background-networking',
        ],
      });

      const page = await browser.newPage();

      // A4 viewport at 2x deviceScaleFactor for retina-quality output
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

      // Navigate and wait for all network requests to finish
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

      // Wait until the React app signals all charts are mounted
      await page.waitForFunction(
        '() => window.__CHARTS_READY__ === true',
        { timeout: 20_000 },
      );

      const rawBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        // Margins are handled by the CSS — Puppeteer gets zero margin
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        preferCSSPageSize: true,
      });

      const pdfBuffer = Buffer.from(rawBuffer);
      this.logger.log(`PDF ready — ${pdfBuffer.length} bytes`);
      return pdfBuffer;
    } finally {
      await browser?.close();
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}
