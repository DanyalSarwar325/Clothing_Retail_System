/**
 * Improved Invoice PDF Processing Route
 * Uses PyPDF2 Python service for reliable tracking ID extraction
 * 
 * Make sure the Python PDF service is running:
 * cd services/invoice_pdf_service && ./run.sh (or run.bat on Windows)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/libs/prisma';

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
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF file.' },
        { status: 400 }
      );
    }

    console.log(`[PDF Processing] Processing file: ${file.name} (${file.size} bytes)`);

    // Prepare form data for Python service
    const serviceFormData = new FormData();
    serviceFormData.append('file', file);

    // Call Python PDF service
    console.log(`[PDF Processing] Calling PDF service at ${PDF_SERVICE_URL}/extract-tracking`);
    
    let pdfResult: PDFExtractionResult;
    try {
      const response = await fetch(`${PDF_SERVICE_URL}/extract-tracking`, {
        method: 'POST',
        body: serviceFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PDF Processing] Service error (${response.status}):`, errorText);
        throw new Error(`PDF service returned status ${response.status}: ${errorText}`);
      }

      pdfResult = await response.json();
    } catch (fetchErr) {
      console.error('[PDF Processing] Failed to call PDF service:', fetchErr);
      
      // Fallback: Check if service is running
      return NextResponse.json(
        {
          error: 'PDF processing service is unavailable. Please ensure the Python service is running on port 8000.',
          details: fetchErr instanceof Error ? fetchErr.message : 'Connection failed',
          instructions: 'Run: cd services/invoice_pdf_service && python main.py',
        },
        { status: 503 }
      );
    }

    if (!pdfResult.success) {
      console.error('[PDF Processing] Extraction failed:', pdfResult.error);
      return NextResponse.json(
        { 
          error: pdfResult.error || 'Failed to extract tracking IDs from PDF',
          debug: pdfResult.debug,
        },
        { status: 400 }
      );
    }

    // No tracking IDs found
    if (!pdfResult.tracking_ids || pdfResult.tracking_ids.length === 0) {
      console.warn('[PDF Processing] No tracking IDs found in PDF');
      
      try {
        await prisma.invoiceLog.create({
          data: {
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
          },
        });
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

    // Update orders with matching tracking IDs
    const processedOrders: any[] = [];
    let markedPaidCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    const allFulfillments = await prisma.fulfillmentOrder.findMany();

    for (const trackingId of pdfResult.tracking_ids) {
      try {
        const fulfillment = allFulfillments.find(
          (f: any) => f.fulfillment?.trackingNumber === trackingId
        );

        if (fulfillment) {
          const fData = (fulfillment.fulfillment as any) || {};
          const pData = (fulfillment.payment as any) || {};

          // Only mark as paid if status is "delivered"
          if (fData?.status?.toLowerCase() === 'delivered') {
            await prisma.fulfillmentOrder.update({
              where: { id: fulfillment.id },
              data: {
                payment: {
                  ...pData,
                  status: 'paid',
                },
              },
            });
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
              status: `SKIPPED (status: ${fData?.status || 'unknown'})`,
              orderStatus: fData?.status || 'unknown',
            });
            skippedCount++;
            console.log(`[PDF Processing] ⊘ Skipped: ${trackingId} (status: ${fData?.status})`);
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
      await prisma.invoiceLog.create({
        data: {
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
        },
      });
      console.log('[PDF Processing] Invoice log saved');
    } catch (logErr) {
      console.error('[PDF Processing] Failed to save invoice log:', logErr);
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
