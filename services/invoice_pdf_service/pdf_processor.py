"""
PDF Processing module using PyPDF2 for reliable tracking ID extraction
"""

import re
from typing import List, Dict, Set, Tuple
from PyPDF2 import PdfReader
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


class PDFProcessor:
    """Process PDF files and extract tracking IDs with high reliability"""
    
    # Define patterns for tracking IDs
    TRACKING_PATTERNS = [
        # Numeric tracking numbers (11+ digits) - for PostEx/logistics
        r'(\d{10,15})',
        # CPR format with letters
        r'(?:Tracking\s+(?:Number|ID|Code|#)[:\s]+)([A-Z0-9\-\.]{8,30})',
        r'(?:CPR|TRK|TRACK)[\-\s]?([A-Z0-9\-]{8,25})',
        r'(?:Reference\s+(?:Number|ID|#)[:\s]+)([A-Z0-9\-\.]{8,30})',
        r'(?:Order\s+(?:Number|ID|#)[:\s]+)([A-Z0-9\-\.]{8,30})',
        r'(?:Shipment\s+(?:ID|Number)[:\s]+)([A-Z0-9\-\.]{8,30})',
        r'(?:Parcel\s+(?:ID|Number)[:\s]+)([A-Z0-9\-\.]{8,30})',
        r'(?:Package\s+(?:ID|Number)[:\s]+)([A-Z0-9\-\.]{8,30})',
    ]
    
    # False positive keywords to exclude
    FALSE_POSITIVES = {
        'INVOICE', 'POSTEX', 'PAID', 'DELIVERED', 'PENDING',
        'PDF', 'DOC', 'FILE', 'PAGE', 'DATE', 'AMOUNT', 'TOTAL',
        'TRACKING', 'NUMBER', 'AAAA', 'ZZZZ', 'XXXX', 'TEST',
        'DUMMY', 'SAMPLE', 'DRAFT', 'EXAMPLE', 'TEMPLATE',
        'RECEIPT', 'LABEL', 'FORM', 'DOCUMENT', 'COPY',
    }
    
    @staticmethod
    def extract_text_from_pdf(pdf_bytes: bytes) -> Tuple[str, bool, str]:
        """
        Extract text from PDF using PyPDF2
        
        Args:
            pdf_bytes: PDF file as bytes
            
        Returns:
            Tuple of (extracted_text, success, error_message)
        """
        try:
            pdf_file = BytesIO(pdf_bytes)
            pdf_reader = PdfReader(pdf_file)
            
            if not pdf_reader.pages:
                return "", False, "PDF has no pages"
            
            extracted_text = ""
            page_count = len(pdf_reader.pages)
            
            # Extract text from all pages (PyPDF2 is reliable for text-based PDFs)
            for page_num, page in enumerate(pdf_reader.pages):
                try:
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"
                except Exception as e:
                    logger.warning(f"Error extracting page {page_num + 1}: {str(e)}")
                    continue
            
            if not extracted_text or len(extracted_text.strip()) < 10:
                return "", False, "PDF appears to be image-based or encrypted. Use OCR-capable tool first."
            
            return extracted_text, True, ""
            
        except Exception as e:
            error_msg = f"Failed to parse PDF: {str(e)}"
            logger.error(error_msg)
            return "", False, error_msg
    
    @staticmethod
    def extract_tracking_ids_with_details(text: str) -> Tuple[List[Dict], Dict]:
        """
        Extract tracking IDs with their position and status details.
        Optimized for PostEx Cash Payment Receipt format.
        
        Args:
            text: Extracted PDF text
            
        Returns:
            Tuple of (tracking_details_list, debug_info)
            where tracking_details = [{id, line_number, status, context}, ...]
        """
        tracking_details = []
        debug_info = {
            'pattern_matches': {},
            'column_extraction': False,
            'validation_filters': 0,
            'extraction_methods': []
        }
        
        lines = text.split('\n')
        tracking_ids_found = {}  # To avoid duplicates while tracking position
        sequence_number = 0
        
        # Build a context window - combine 3 consecutive lines for status detection
        # This helps capture status info that may be on adjacent lines
        for i, line in enumerate(lines):
            trimmed = line.strip()
            
            if not trimmed or len(trimmed) < 2:
                continue
            
            # Look for tracking ID pattern (11-14 digits at start of line, with kg weight on next line)
            # PostEx format: "22101030038062\n0.99 kg"
            match = re.match(r'^(\d{11,14})\s*$', trimmed)
            if match:
                candidate = match.group(1)
                
                # Check if next line contains weight (kg) - confirms it's a tracking number
                next_line = (lines[i + 1].strip() if i + 1 < len(lines) else "").lower()
                has_weight = 'kg' in next_line
                
                if PDFProcessor._is_valid_tracking_id(candidate, has_weight) and candidate not in tracking_ids_found:
                    sequence_number += 1
                    
                    # Build context: current line + next 2 lines for status detection
                    context_lines = [lines[i].strip()]
                    if i + 1 < len(lines):
                        context_lines.append(lines[i + 1].strip())
                    if i + 2 < len(lines):
                        context_lines.append(lines[i + 2].strip())
                    
                    full_context = ' '.join(context_lines)
                    
                    # Detect status from context window
                    status = PDFProcessor._detect_tracking_status(full_context)
                    
                    tracking_ids_found[candidate] = {
                        'id': candidate,
                        'sequence': sequence_number,
                        'line_number': i + 1,
                        'status': status,
                        'context': full_context[:100],  # First 100 chars of context
                        'pattern_type': 'numeric_table',
                    }
                    debug_info['extraction_methods'].append(f'numeric_table_line_{i + 1}')
                    continue
            
            # Fallback: Try general numeric patterns if not found as pure numeric
            numeric_matches = re.findall(r'(\d{11,14})', trimmed)
            for candidate in numeric_matches:
                if PDFProcessor._is_valid_tracking_id(candidate, False) and candidate not in tracking_ids_found:
                    sequence_number += 1
                    
                    # Build context for status detection
                    context_lines = [trimmed]
                    if i + 1 < len(lines):
                        context_lines.append(lines[i + 1].strip())
                    
                    full_context = ' '.join(context_lines)
                    status = PDFProcessor._detect_tracking_status(full_context)
                    
                    tracking_ids_found[candidate] = {
                        'id': candidate,
                        'sequence': sequence_number,
                        'line_number': i + 1,
                        'status': status,
                        'context': full_context[:100],
                        'pattern_type': 'numeric_fallback',
                    }
        
        # Convert to list and sort by sequence
        tracking_details = sorted(list(tracking_ids_found.values()), key=lambda x: x['sequence'])
        
        return tracking_details, debug_info
    
    @staticmethod
    def _detect_tracking_status(line: str) -> str:
        """
        Detect delivery status from line context
        PostEx format: "Delivered" or "Return" appears with tracking info
        
        Args:
            line: Line of text containing the tracking ID or surrounding context
            
        Returns:
            Status string (Delivered, In Transit, Pending, Failed, Unknown)
        """
        line_upper = line.upper()
        
        # Check for delivery status keywords (PostEx format)
        if 'DELIVERED' in line_upper or 'DELIVERY' in line_upper:
            return 'Delivered'
        
        if 'RETURN' in line_upper:
            return 'Return'
        
        # Additional status keywords
        if any(keyword in line_upper for keyword in ['DELIVERED', 'COMPLETED', 'ARRIVED', 'DONE']):
            return 'Delivered'
        elif any(keyword in line_upper for keyword in ['IN TRANSIT', 'SHIPPING', 'DISPATCHED', 'SENT']):
            return 'In Transit'
        elif any(keyword in line_upper for keyword in ['PENDING', 'AWAITING', 'PROCESSING', 'PENDING PICKUP']):
            return 'Pending'
        elif any(keyword in line_upper for keyword in ['FAILED', 'EXCEPTION', 'LOST']):
            return 'Failed'
        else:
            return 'Unknown'
    
    @staticmethod
    def extract_tracking_ids(text: str) -> Tuple[Set[str], List[str], Dict]:
        """
        Extract tracking IDs from text using pattern matching
        
        Args:
            text: Extracted PDF text
            
        Returns:
            Tuple of (tracking_ids_set, all_candidates, debug_info)
        """
        tracking_ids: Set[str] = set()
        all_candidates: List[str] = []
        debug_info = {
            'pattern_matches': {},
            'column_extraction': False,
            'validation_filters': 0,
            'extraction_methods': []
        }
        
        # Method 0: Direct table row extraction
        # Look for pattern like "22101030038062\n0.99 kg" (tracking number followed by weight)
        table_row_pattern = r'(\d{10,15})\s*\n\s*[\d.]+\s*kg'
        table_matches = re.finditer(table_row_pattern, text, re.MULTILINE)
        for match in table_matches:
            candidate = match.group(1)
            if PDFProcessor._is_valid_tracking_id(candidate, has_weight=True):
                tracking_ids.add(candidate)
                all_candidates.append(candidate)
                debug_info['extraction_methods'].append('table_row_pattern')
                logger.debug(f"Added from table row: {candidate}")
        
        if tracking_ids:
            debug_info['pattern_matches']['table_row'] = len(tracking_ids)
            return tracking_ids, all_candidates, debug_info
        
        # Method 1: Try column-based extraction - More flexible patterns
        tracking_column_patterns = [
            # Look for Tracking Number header (handles wrapped "Tracking\nNumber")
            r'(?:Tracking(?:\s+Number|\s*\n\s*Number))[:\n\s]*([\s\S]*?)(?=(?:\n\s*(?:Total|Amount|Balance|Summary|Shipping|Subtotal|Tax|Date|Customer|Developed by))|$)',
            # Look for column with multiple tracking-like numbers
            r'(?:Origin\s+City[^\n]*\n)([\s\S]*?)(?=(?:\n\s*(?:Total|Amount|Balance|Summary|Shipping|Subtotal|Tax|Developed))|$)',
            # Generic approach: find sequences of 10-15 digit codes
            r'(?:Tracking|Number|ID|Code|Reference)[:\s\n]+([\s\S]*?)(?=(?:\n\s*(?:Total|Amount|Balance|Summary|Shipping|Subtotal|Tax))|$)',
        ]
        
        for pattern_idx, col_pattern in enumerate(tracking_column_patterns):
            column_match = re.search(col_pattern, text, re.IGNORECASE | re.MULTILINE)
            
            if column_match:
                debug_info['column_extraction'] = True
                debug_info['extraction_methods'].append(f'column_pattern_{pattern_idx}')
                
                column_content = column_match.group(1)
                logger.debug(f"Found column content (pattern {pattern_idx}): {column_content[:300]}")
                
                lines = column_content.split('\n')
                
                for line in lines:
                    trimmed = line.strip()
                    
                    # Skip empty lines and common headers
                    if not trimmed or len(trimmed) < 2:
                        continue
                    
                    # Try to extract numeric tracking numbers (8-15 digits)
                    numeric_matches = re.findall(r'(\d{8,15})', trimmed)
                    for candidate in numeric_matches:
                        if PDFProcessor._is_valid_tracking_id(candidate, has_weight=False):
                            tracking_ids.add(candidate)
                            all_candidates.append(candidate)
                            logger.debug(f"Added from column: {candidate}")
                    
                    # Also try alphanumeric patterns
                    alphanumeric_matches = re.findall(r'([A-Z0-9\-\.]{8,30})', trimmed.upper())
                    for candidate in alphanumeric_matches:
                        if PDFProcessor._is_valid_tracking_id(candidate, has_weight=False):
                            tracking_ids.add(candidate)
                            all_candidates.append(candidate)
                            logger.debug(f"Added alphanumeric from column: {candidate}")
                
                if tracking_ids:
                    debug_info['pattern_matches'][f'column_pattern_{pattern_idx}'] = len(tracking_ids)
                    # If we found tracking IDs in column, stop trying other patterns
                    if len(tracking_ids) > 0:
                        break
        
        # Method 2: Pattern-based extraction
        for pattern_idx, pattern in enumerate(PDFProcessor.TRACKING_PATTERNS):
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                candidate = (match.group(1) or match.group(0)).upper().strip()
                if PDFProcessor._is_valid_tracking_id(candidate, has_weight=False):
                    tracking_ids.add(candidate)
                    all_candidates.append(candidate)
                    pattern_key = f'pattern_{pattern_idx}'
                    debug_info['pattern_matches'][pattern_key] = len(tracking_ids)
                    debug_info['extraction_methods'].append(pattern_key)
        
        debug_info['validation_filters'] = len(all_candidates) - len(tracking_ids)
        
        return tracking_ids, all_candidates, debug_info
    
    @staticmethod
    def _is_valid_tracking_id(candidate: str, has_weight: bool = False) -> bool:
        """
        Validate if a candidate string is a real tracking ID
        
        Args:
            candidate: Candidate string to validate
            has_weight: Whether the next line contains "kg" (PostEx format confirmation)
            
        Returns:
            True if valid tracking ID, False otherwise
        """
        # Remove whitespace
        candidate = candidate.strip()
        
        # Length check
        if len(candidate) < 8 or len(candidate) > 30:
            return False
        
        # Common false positives - phone numbers typically start with 0-3 and are 10-11 digits
        # Check if it looks like a Pakistani phone number (0xxx format)
        if candidate.startswith('0') and len(candidate) == 11 and candidate.isdigit():
            # If has_weight, it's likely a tracking number (PostEx format)
            if not has_weight:
                return False  # Otherwise it's likely a phone number
        
        # Check for false positives - must be exact word match (not substring)
        for fp in PDFProcessor.FALSE_POSITIVES:
            if candidate == fp or candidate.endswith(fp) or candidate.startswith(fp):
                # But allow if it's CPR-XXXX or numeric format
                if 'CPR' in candidate or 'TRK' in candidate or candidate.isdigit():
                    continue
                return False
        
        # Must be either:
        # 1. Pure numeric (8-15 digits for PostEx-style)
        # 2. Alphanumeric with some letters
        if candidate.isdigit():
            # Numeric tracking IDs are valid if 8-15 digits
            return len(candidate) >= 8 and len(candidate) <= 15
        
        # Alphanumeric check
        if not re.search(r'[A-Z0-9]', candidate):
            return False
        
        # Should not be all same character or mostly same
        unique_chars = len(set(candidate.replace('-', '').replace('.', '')))
        if unique_chars < 2:  # At least 2 unique characters
            return False
        
        return True
    
    @staticmethod
    def process_pdf(pdf_bytes: bytes) -> Dict:
        """
        Complete PDF processing pipeline
        
        Args:
            pdf_bytes: PDF file as bytes
            
        Returns:
            Dictionary with results and metadata
        """
        result = {
            'success': False,
            'tracking_ids': [],
            'tracking_details': [],  # NEW: Detailed tracking information
            'extracted_text': '',
            'text_length': 0,
            'error': None,
            'debug': {
                'extraction_method': 'pypdf2',
                'page_count': 0,
                'pattern_analysis': {}
            }
        }
        
        try:
            # Extract text
            text, success, error_msg = PDFProcessor.extract_text_from_pdf(pdf_bytes)
            
            if not success:
                result['error'] = error_msg
                return result
            
            result['extracted_text'] = text
            result['text_length'] = len(text)
            result['debug']['page_count'] = text.count('\n')
            
            # Extract tracking IDs with detailed information
            tracking_details, pattern_info = PDFProcessor.extract_tracking_ids_with_details(text)
            
            # Also get simple list for backward compatibility
            tracking_ids, candidates, simple_pattern_info = PDFProcessor.extract_tracking_ids(text)
            
            result['tracking_ids'] = sorted(list(tracking_ids))
            result['tracking_details'] = tracking_details  # NEW: Include detailed info
            result['success'] = len(tracking_ids) > 0
            result['debug']['pattern_analysis'] = pattern_info
            result['debug']['total_candidates'] = len(candidates)
            result['debug']['filtered_count'] = len(candidates) - len(tracking_ids)
            
            logger.info(f"Successfully extracted {len(tracking_ids)} tracking IDs from PDF with details")
            
        except Exception as e:
            result['error'] = f"Critical error during PDF processing: {str(e)}"
            logger.error(result['error'], exc_info=True)
        
        return result
