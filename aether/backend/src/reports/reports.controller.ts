import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  UseGuards,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Store preview data and get a short-lived token.
   * Frontend calls this first, then calls export-pdf with the token.
   */
  @Post('store-preview')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  storePreview(@Body() body: Record<string, unknown>) {
    const previewToken = this.reportsService.storePreview(body);
    return { previewToken };
  }

  /**
   * Get preview data by token (no auth required — token IS the secret).
   * Called by the PrintPreviewPage in the browser (inside Puppeteer).
   */
  @Get('preview-data/:token')
  getPreviewData(@Param('token') token: string) {
    const data = this.reportsService.getPreviewData(token);
    if (!data) throw new NotFoundException('Preview data not found or expired');
    return data;
  }

  /**
   * Generate PDF via Puppeteer.
   * Puppeteer navigates to /reports/print-preview?token=xxx on the frontend,
   * waits for charts to render, and returns the PDF buffer.
   */
  @Post('export-pdf')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async exportPdf(
    @Body() body: { previewToken: string; filename?: string },
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportsService.generatePDF(body.previewToken);
    const filename = body.filename ?? 'aether-report.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  }
}
