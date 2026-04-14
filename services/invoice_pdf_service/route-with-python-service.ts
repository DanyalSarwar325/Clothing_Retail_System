/**
 * Improved Invoice PDF Processing Route
 * Uses PyPDF2 Python service for reliable tracking ID extraction
 * 
 * Make sure the Python PDF service is running:
 * cd services/invoice_pdf_service && ./run.sh (or run.bat on Windows)
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/libs/dbConnect';
import InvoiceLog from '@/app/libs/models/invoiceLog';

// Configure PDF service URL
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'http://127.0.0.1:8000';

interface PDFExtractionResult {
  success: boolean;
  tracking_ids: string[];
  extracted_text: string;
  text_length: number;
  error?: string;
  debug?: {
    extraction_method: string;
    page_count: number;
    pattern_analysis: Record<string, unknown>;
  };
}

/**
 * POST handler for invoice PDF processing
 * Extracts tracking IDs and marks matching orders as paid
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[PDF Processing] Starting invoice processing');
    
    await dbConnect();
    console.log('[PDF Processing] Database connected');

    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Validate file
    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    console.log(`[PDF Processing] Processing file: ${file.name} (${file.size} bytes)`);

    // Forward to Python service
    console.log(`[PDF Processing] Calling PDF service at ${PDF_SERVICE_URL}`);
    
    const pdfFormData = new FormData();
    pdfFormData.append('file', file);

    let pdfResponse: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      pdfResponse = await fetch(`${PDF_SERVICE_URL}/extract-tracking-ids`, {
        method: 'POST',
        body: pdfFormData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      console.error('[PDF Processing] Failed to connect to PDF service:', fetchError.message);
      return NextResponse.json(
        {
          error: 'PDF processing service is not available',
          details: `Could not connect to ${PDF_SERVICE_URL}. Make sure the Python service is running.`,
          suggestion: 'Start the service: cd services/invoice_pdf_service && ./run.sh',
        },
        { status: 503 }
      );
    }

    if (!pdfResponse.ok) {
      const errorData = await pdfResponse.json().catch(() => ({}));
      console.error('[PDF Processing] PDF service error:', errorData);
      
      return NextResponse.json(
        {
          error: errorData.error || 'PDF processing failed',
          details: errorData.detail || errorData,
        },
        { status: pdfResponse.status }
      );
    }

    const pdfResult: PDFExtractionResult = await pdfResponse.json();
    console.log('[PDF Processing] PDF service response received');
    console.log(`[PDF Processing] Tracking IDs found: ${pdfResult.tracking_ids.length}`);
    console.log(`[PDF Processing] Extraction method: ${pdfResult.debug?.extraction_method}`);

    // Handle extraction failure
    if (!pdfResult.success) {
      console.warn('[PDF Processing] PDF extraction was not successful');
      
      // Save error log
      try {
        const errorLog = new InvoiceLog({
          fileName: file.name,
          fileSize: file.size,
          uploadedBy: 'admin',
          trackingIdsFound: 0,
          trackingIds: [],
          processedResults: [],
          processingSummary: {
            totalTracking: 0,
            markedPaid: 0,
            skipped: 0,
            notFound: 0,
            errors: 0,
          },
          parsingStatus: 'error',
          parsingMethod: 'pypdf2-service',
          errorMessage: pdfResult.error || 'Unknown extraction error',
        });
        await errorLog.save();
      } catch (logErr) {
        console.error('[PDF Processing] Failed to save error log:', logErr);
      }

      return NextResponse.json(
        {
          error: pdfResult.error || 'Unable to extract text from PDF',
          suggestions: [
            'Ensure the PDF contains a "Tracking Number" column',
            'Verify tracking numbers are visible in the PDF (not image-based/scanned)',
            'Check that the PDF is not encrypted or corrupted',
            'Supported formats: CPR-XXXXX, TRK-XXXXX, or alphanumeric codes (8-30 characters)',
          ],
          debug: pdfResult.debug,
        },
        { status: 400 }
      );
    }

    // No tracking IDs found
    if (!pdfResult.tracking_ids || pdfResult.tracking_ids.length === 0) {
      console.warn('[PDF Processing] No tracking IDs found in PDF');
      
      try {
        const errorLog = new InvoiceLog({
          fileName: file.name,
          fileSize: file.size,
          uploadedBy: 'admin',
          trackingIdsFound: 0,
          trackingIds: [],
          extractedText: pdfResult.extracted_text.substring(0, 10000),
          processedResults: [],
          processingSummary: {
            totalTracking: 0,
            markedPaid: 0,
            skipped: 0,
            notFound: 0,
            errors: 0,
          },
          parsingStatus: 'no-tracking-ids',
          parsingMethod: 'pypdf2-service',
        });
        await errorLog.save();
      } catch (logErr) {
        console.error('[PDF Processing] Failed to save log:', logErr);
      }

      return NextResponse.json(
        {
          error: 'No tracking IDs could be extracted from the PDF',
          suggestions: [
            'Ensure the PDF contains a "Tracking Number" column',
            'Check that tracking numbers are visible',
            'Verify supported format: CPR-XXXXX, TRK-XXXXX, etc.',
          ],
          textLength: pdfResult.text_length,
          debug: pdfResult.debug,
        },
        { status: 400 }
      );
    }

    console.log(`[PDF Processing] Processing ${pdfResult.tracking_ids.length} tracking IDs`);

    // Import the fulfillment model
    const FulfillmentOrder = 
      require('@/app/libs/models/fulfillmentOrder').default || 
      require('@/app/libs/models/fulfillmentOrder');

    // Update orders with matching tracking IDs
    const processedOrders: any[] = [];
    let markedPaidCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const trackingId of pdfResult.tracking_ids) {
      try {
        const fulfillment = await FulfillmentOrder.findOne({
          'fulfillment.trackingNumber': trackingId,
        });

        if (fulfillment) {
          // Only mark as paid if status is "delivered"
          if (fulfillment.fulfillment?.status?.toLowerCase() === 'delivered') {
            fulfillment.payment.status = 'paid';
            await fulfillment.save();
            processedOrders.push({
              trackingId,
              status: 'MARKED PAID',
              orderStatus: 'delivered',
            });
            markedPaidCount++;
            console.log(`[PDF Processing] ✓ Marked paid: ${trackingId}`);
          } else {
            processedOrders.push({
              trackingId,
              status: `SKIPPED (status: ${fulfillment.fulfillment?.status || 'unknown'})`,
              orderStatus: fulfillment.fulfillment?.status || 'unknown',
            });
            skippedCount++;
            console.log(`[PDF Processing] ⊘ Skipped: ${trackingId} (status: ${fulfillment.fulfillment?.status})`);
          }
        } else {
          processedOrders.push({
            trackingId,
            status: 'NOT FOUND in database',
          });
          notFoundCount++;
          console.log(`[PDF Processing] ✗ Not found: ${trackingId}`);
        }
      } catch (err) {
        console.error(`[PDF Processing] Error processing ${trackingId}:`, err);
        processedOrders.push({
          trackingId,
          status: 'ERROR processing',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        errorCount++;
      }
    }

    // Save invoice log
    try {
      const invoiceLog = new InvoiceLog({
        fileName: file.name,
        fileSize: file.size,
        uploadedBy: 'admin',
        extractedText: pdfResult.extracted_text.substring(0, 50000), // Limit to 50KB
        trackingIdsFound: pdfResult.tracking_ids.length,
        trackingIds: pdfResult.tracking_ids,
        processedResults: processedOrders,
        processingSummary: {
          totalTracking: pdfResult.tracking_ids.length,
          markedPaid: markedPaidCount,
          skipped: skippedCount,
          notFound: notFoundCount,
          errors: errorCount,
        },
        parsingStatus: 'success',
        parsingMethod: 'pypdf2-service',
      });

      await invoiceLog.save();
      console.log('[PDF Processing] Invoice log saved');
    } catch (logErr) {
      console.error('[PDF Processing] Failed to save invoice log:', logErr);
      // Continue even if log save fails
    }

    const duration = Date.now() - startTime;
    console.log(`[PDF Processing] ✓ Complete in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${pdfResult.tracking_ids.length} tracking IDs`,
      trackingIds: pdfResult.tracking_ids,
      processedOrders,
      summary: {
        total: pdfResult.tracking_ids.length,
        markedPaid: markedPaidCount,
        skipped: skippedCount,
        notFound: notFoundCount,
        errors: errorCount,
      },
      extractionMethod: 'pypdf2-service',
      processingTime: `${duration}ms`,
    });

  } catch (error: any) {
    console.error('[PDF Processing] Unexpected error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to process invoice',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined,
      },
      { status: 500 }
    );
  }
}
