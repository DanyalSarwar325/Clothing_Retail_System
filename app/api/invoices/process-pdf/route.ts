import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import dbConnect from '@/app/libs/dbConnect';
import InvoiceLog from '@/app/libs/models/invoiceLog';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const formData = await request.formData();
    const file = formData.get('file') as File;

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

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    // Parse PDF to extract tracking IDs
    let extractedText: string = '';
    let parseSuccess = false;
    
    // Method 1: Try pdf-parse
    if (!parseSuccess) {
      try {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(fileBuffer);
        extractedText = pdfData.text;
        parseSuccess = extractedText && extractedText.length > 0;
        console.log('PDF parse success (pdf-parse):', parseSuccess);
      } catch (err) {
        console.log('pdf-parse failed, trying alternative...');
      }
    }

    // Method 2: Try pdfjs-dist
    if (!parseSuccess) {
      try {
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
        const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        let text = '';
        
        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) { // Limit to first 10 pages
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            text += textContent.items.map((item: any) => item.str).join(' ') + '\n';
          } catch (pageErr) {
            console.log(`Error reading page ${i}:`, pageErr);
            continue;
          }
        }
        
        extractedText = text;
        parseSuccess = extractedText && extractedText.length > 0;
        console.log('PDF parse success (pdfjs-dist):', parseSuccess);
      } catch (err) {
        console.log('pdfjs-dist failed:', err);
      }
    }

    // Method 3: Fallback - Extract raw text from PDF stream
    if (!parseSuccess) {
      try {
        const text = fileBuffer.toString('latin1');
        // Remove control characters and decode common patterns
        extractedText = text
          .split(/\x00+/)
          .join('')
          .replace(/[^\x20-\x7E\n\r]/g, ' ')
          .trim();
        
        parseSuccess = extractedText && extractedText.length > 50;
        console.log('PDF parse success (raw extraction):', parseSuccess);
      } catch (err) {
        console.log('Raw extraction failed:', err);
      }
    }

    if (!parseSuccess || extractedText.length < 10) {
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
          errorMessage: 'Unable to extract text from PDF',
        });
        await errorLog.save();
      } catch (logErr) {
        console.log('Failed to save error log:', logErr);
      }

      return NextResponse.json(
        { 
          error: 'Unable to extract text from PDF. The file might be:\n1. Image-based/scanned (no OCR available)\n2. Corrupted or encrypted\n3. In an unsupported format\n\nFor scanned PDFs, please use a tool to convert to text-based PDF first.',
          details: {
            fileSize: fileBuffer.length,
            textLength: extractedText.length,
            sampleText: extractedText.substring(0, 200)
          }
        },
        { status: 400 }
      );
    }

    console.log('Extracted text length:', extractedText.length);
    console.log('Sample text:', extractedText.substring(0, 500));

    // Extract tracking IDs with column-based and pattern-based methods
    const trackingIds = new Set<string>();
    const allMatches: string[] = [];

    // Method 1: Extract from "Tracking Number" column
    // Look for the column header and extract values below it
    const columnMatch = extractedText.match(/Tracking\s+Number[^\n]*\n([\s\S]*?)(?=\n\s*(?:Total|Amount|Balance|$))/i);
    if (columnMatch) {
      const columnContent = columnMatch[1];
      // Split by newlines and extract non-empty lines with tracking-like patterns
      const lines = columnContent.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        // Extract alphanumeric strings that look like tracking numbers
        const matches = trimmedLine.match(/([A-Z0-9\-]{8,30})/g);
        if (matches) {
          for (const match of matches) {
            const trackingId = match.toUpperCase().trim();
            // Filter out common false positives
            const falsePositives = [
              'INVOICE', 'POSTEX', 'PAID', 'DELIVERED', 'PENDING', 
              'PDF', 'DOC', 'FILE', 'PAGE', 'DATE', 'AMOUNT', 'TOTAL',
              'TRACKING', 'NUMBER', 'AAAA', 'ZZZZ', 'XXXX',
            ];
            
            if (!falsePositives.some(fp => trackingId.includes(fp)) && 
                trackingId.length >= 8 &&
                trackingId.length <= 30 &&
                (trackingId.startsWith('CPR') || trackingId.startsWith('TRK') || /^[A-Z0-9]{10,}$/.test(trackingId))) {
              trackingIds.add(trackingId);
              allMatches.push(trackingId);
            }
          }
        }
      }
      console.log('Tracking IDs found from column:', trackingIds.size);
    }

    // Method 2: Try pattern-based extraction if column extraction didn't work
    if (trackingIds.size === 0) {
      const trackingPatterns = [
        /(?:Tracking\s+(?:Number|ID|Code)[:\s]+)([A-Z0-9\-]{8,30})/gi,
        /(?:CPR|TRK)[\-\s]?([A-Z0-9]{8,25})/gi,
        /(?:Tracking[:\s]+|reference[:\s]+|order[:\s]+)([A-Z0-9]{8,25})/gi,
        /([A-Z0-9]{10,20})/g, // Generic 10-20 char codes
      ];

      for (const pattern of trackingPatterns) {
        let match;
        while ((match = pattern.exec(extractedText)) !== null) {
          const trackingId = (match[1] || match[0]).toUpperCase().trim();
          
          const falsePositives = [
            'INVOICE', 'POSTEX', 'PAID', 'DELIVERED', 'PENDING', 
            'PDF', 'DOC', 'FILE', 'PAGE', 'DATE', 'AMOUNT', 'TOTAL',
            'TRACKING', 'NUMBER', 'AAAA', 'ZZZZ', 'XXXX',
          ];
          
          if (!falsePositives.some(fp => trackingId.includes(fp)) && 
              trackingId.length >= 8 &&
              trackingId.length <= 25) {
            trackingIds.add(trackingId);
            allMatches.push(trackingId);
          }
        }
        
        if (trackingIds.size > 0) break;
      }
    }

    if (trackingIds.size === 0) {
      // Return debugging info instead of error
      return NextResponse.json(
        {
          error: 'No tracking IDs could be extracted from the PDF content.',
          suggestions: [
            'Ensure the PDF contains a "Tracking Number" column',
            'Check that tracking numbers are visible in the PDF (not image-based)',
            'Verify the PDF is not encrypted or corrupted',
            'Supported formats: CPR-XXXXX, TRK-XXXXX, or alphanumeric codes (8-30 characters)'
          ],
          debugInfo: {
            extractedTextLength: extractedText.length,
            extractedTextSample: extractedText.substring(0, 1000),
            foundCandidates: Array.from(allMatches).slice(0, 20),
            candidateCount: allMatches.length,
            // Look for column headers
            hasTrackingHeader: /Tracking\s+Number/i.test(extractedText),
            allLines: extractedText.split('\n').filter((line: string) => line.trim().length > 0).slice(0, 30)
          }
        },
        { status: 400 }
      );
    }

    console.log('Found tracking IDs:', Array.from(trackingIds));

    // Import the fulfillment model
    const FulfillmentOrder = require('@/app/libs/models/fulfillmentOrder').default || require('@/app/libs/models/fulfillmentOrder');

    // Update orders with matching tracking IDs to "paid" status
    const processedOrders: any[] = [];
    let markedPaidCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const trackingId of trackingIds) {
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
              status: 'MARKED PAID (was delivered)',
              orderStatus: 'delivered',
            });
            markedPaidCount++;
          } else {
            processedOrders.push({
              trackingId,
              status: `SKIPPED (status: ${fulfillment.fulfillment?.status || 'unknown'})`,
              orderStatus: fulfillment.fulfillment?.status || 'unknown',
            });
            skippedCount++;
          }
        } else {
          processedOrders.push({
            trackingId,
            status: 'NOT FOUND in database',
          });
          notFoundCount++;
        }
      } catch (err) {
        console.error(`Error processing tracking ${trackingId}:`, err);
        processedOrders.push({
          trackingId,
          status: 'ERROR processing',
        });
        errorCount++;
      }
    }

    // Save invoice log to database
    try {
      const invoiceLog = new InvoiceLog({
        fileName: file.name,
        fileSize: file.size,
        uploadedBy: 'admin',
        extractedText: extractedText.substring(0, 50000), // Limit to 50KB
        trackingIdsFound: trackingIds.size,
        trackingIds: Array.from(trackingIds),
        processedResults: processedOrders,
        processingSummary: {
          totalTracking: trackingIds.size,
          markedPaid: markedPaidCount,
          skipped: skippedCount,
          notFound: notFoundCount,
          errors: errorCount,
        },
        parsingStatus: 'success',
        parsingMethod: 'Multi-pattern matching',
      });

      await invoiceLog.save();
    } catch (logErr) {
      console.error('Failed to save invoice log:', logErr);
      // Continue even if log save fails
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${markedPaidCount} orders marked as paid`,
      processedOrders,
      totalTrackingIds: trackingIds.size,
      summary: {
        markedPaid: markedPaidCount,
        skipped: skippedCount,
        notFound: notFoundCount,
        errors: errorCount,
      },
      extractionMethod: 'Multi-pattern matching',
    });
  } catch (error: any) {
    console.error('Invoice processing error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to process invoice',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  }
}
