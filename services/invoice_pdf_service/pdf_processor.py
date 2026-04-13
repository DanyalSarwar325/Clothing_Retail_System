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
            if PDFProcessor._is_valid_tracking_id(candidate):
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
                        if PDFProcessor._is_valid_tracking_id(candidate):
                            tracking_ids.add(candidate)
                            all_candidates.append(candidate)
                            logger.debug(f"Added from column: {candidate}")
                    
                    # Also try alphanumeric patterns
                    alphanumeric_matches = re.findall(r'([A-Z0-9\-\.]{8,30})', trimmed.upper())
                    for candidate in alphanumeric_matches:
                        if PDFProcessor._is_valid_tracking_id(candidate):
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
                if PDFProcessor._is_valid_tracking_id(candidate):
                    tracking_ids.add(candidate)
                    all_candidates.append(candidate)
                    pattern_key = f'pattern_{pattern_idx}'
                    debug_info['pattern_matches'][pattern_key] = len(tracking_ids)
                    debug_info['extraction_methods'].append(pattern_key)
        
        debug_info['validation_filters'] = len(all_candidates) - len(tracking_ids)
        
        return tracking_ids, all_candidates, debug_info
    
    @staticmethod
    def _is_valid_tracking_id(candidate: str) -> bool:
        """
        Validate if a candidate string is a real tracking ID
        
        Args:
            candidate: Candidate string to validate
            
        Returns:
            True if valid tracking ID, False otherwise
        """
        # Remove whitespace
        candidate = candidate.strip()
        
        # Length check
        if len(candidate) < 8 or len(candidate) > 30:
            return False
        
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
            
            # Extract tracking IDs
            tracking_ids, candidates, pattern_info = PDFProcessor.extract_tracking_ids(text)
            
            result['tracking_ids'] = sorted(list(tracking_ids))
            result['success'] = len(tracking_ids) > 0
            result['debug']['pattern_analysis'] = pattern_info
            result['debug']['total_candidates'] = len(candidates)
            result['debug']['filtered_count'] = len(candidates) - len(tracking_ids)
            
            logger.info(f"Successfully extracted {len(tracking_ids)} tracking IDs from PDF")
            
        except Exception as e:
            result['error'] = f"Critical error during PDF processing: {str(e)}"
            logger.error(result['error'], exc_info=True)
        
        return result
