/**
 * Excel (.xlsx / SpreadsheetML) and CSV Import/Export utilities for LifeOS Finance.
 * Conforms strictly to integer minor units and zero third-party runtime dependency rules.
 */

import type { FinanceTransactionData } from '../../shared/types';

/**
 * Generates an Excel SpreadsheetML XML document (compatible with Excel, Google Sheets, Numbers)
 * and triggers a client-side download as `.xlsx`.
 */
export function exportToExcelXml(
  transactions: FinanceTransactionData[],
  accountNameMap: Map<string, string>,
  filenamePrefix: string = 'lifeos-expenses'
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}-${dateStr}.xlsx`;

  const escapeXml = (str: string | null | undefined): string => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>LifeOS Expense Ledger</Title>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#111827"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#D97706" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DateStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <NumberFormat ss:Format="yyyy-mm-dd"/>
  </Style>
  <Style ss:ID="MoneyExpense">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#DC2626" ss:Bold="1"/>
   <NumberFormat ss:Format="#,##0.00;[Red]-#,##0.00"/>
  </Style>
  <Style ss:ID="MoneyIncome">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#059669" ss:Bold="1"/>
   <NumberFormat ss:Format="+#,##0.00;[Red]-#,##0.00"/>
  </Style>
  <Style ss:ID="MoneyTransfer">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#2563EB"/>
   <NumberFormat ss:Format="#,##0.00;[Red]-#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Expenses &amp; Ledger">
  <Table ss:DefaultColumnWidth="120" ss:DefaultRowHeight="20">
   <Column ss:Width="100"/>
   <Column ss:Width="180"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="200"/>
   <Row ss:StyleID="Header" ss:Height="26">
    <Cell><Data ss:Type="String">Date</Data></Cell>
    <Cell><Data ss:Type="String">Payee / Description</Data></Cell>
    <Cell><Data ss:Type="String">Category</Data></Cell>
    <Cell><Data ss:Type="String">Account</Data></Cell>
    <Cell><Data ss:Type="String">Type</Data></Cell>
    <Cell><Data ss:Type="String">Amount</Data></Cell>
    <Cell><Data ss:Type="String">Notes</Data></Cell>
   </Row>`;

  const rows = transactions.map((t) => {
    const accName = accountNameMap.get(t.accountId) || 'General Account';
    const catName = t.categoryName || 'Uncategorized';
    const amountVal = (t.amountCents / 100).toFixed(2);
    const moneyStyle = t.type === 'income' ? 'MoneyIncome' : t.type === 'expense' ? 'MoneyExpense' : 'MoneyTransfer';
    const signedAmount = t.type === 'expense' ? `-${amountVal}` : amountVal;

    return `   <Row ss:Height="22">
    <Cell ss:StyleID="DateStyle"><Data ss:Type="String">${escapeXml(t.transactionDate)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(t.payee || 'Expense')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(catName)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(accName)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(t.type.toUpperCase())}</Data></Cell>
    <Cell ss:StyleID="${moneyStyle}"><Data ss:Type="Number">${signedAmount}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(t.notes || '')}</Data></Cell>
   </Row>`;
  }).join('\n');

  const xmlFooter = `  </Table>
 </Worksheet>
</Workbook>`;

  const fullXml = `${xmlHeader}\n${rows}\n${xmlFooter}`;
  const blob = new Blob([fullXml], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates standard RFC 4180 CSV and triggers client-side download.
 */
export function exportToCsv(
  transactions: FinanceTransactionData[],
  accountNameMap: Map<string, string>,
  filenamePrefix: string = 'lifeos-expenses'
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}-${dateStr}.csv`;

  const sanitizeCsv = (val: string | null | undefined): string => {
    if (!val) return '""';
    let s = String(val);
    if (/^[=+\-@\t\r]/.test(s)) {
      s = "'" + s;
    }
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = 'Date,Payee,Category,Account,Type,Amount,Notes\n';
  const lines = transactions.map((t) => {
    const accName = accountNameMap.get(t.accountId) || 'General Account';
    const catName = t.categoryName || 'Uncategorized';
    const amountStr = (t.amountCents / 100).toFixed(2);
    return [
      t.transactionDate,
      sanitizeCsv(t.payee || 'Expense'),
      sanitizeCsv(catName),
      sanitizeCsv(accName),
      t.type,
      amountStr,
      sanitizeCsv(t.notes || ''),
    ].join(',');
  });

  const content = header + lines.join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Universal file parser for uploaded spreadsheet & receipt files.
 * Returns normalized CSV string ready for preview endpoint.
 */
export async function parseUploadedSpreadsheet(file: File): Promise<{
  csvText: string;
  isReceipt: boolean;
  receiptPreviewUrl?: string;
  extractedHint?: {
    date?: string;
    payee?: string;
    amount?: string;
  };
}> {
  const fileName = file.name.toLowerCase();

  // 1. Receipt / Attachment Image or PDF
  if (
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.webp') ||
    fileName.endsWith('.pdf')
  ) {
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    // Extract intelligent hints from filename (e.g. "Starbucks_150_2026-09-20.png")
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const dateMatch = file.name.match(/\d{4}-\d{2}-\d{2}/);
    const amountMatch = file.name.match(/\d+(\.\d{1,2})?/);

    return {
      csvText: '',
      isReceipt: true,
      receiptPreviewUrl: previewUrl,
      extractedHint: {
        date: dateMatch ? dateMatch[0] : new Date().toISOString().slice(0, 10),
        payee: cleanName.split(' ')[0] || 'Receipt Expense',
        amount: amountMatch ? amountMatch[0] : '0.00',
      },
    };
  }

  // 2. CSV, TSV, or Plain text
  if (
    fileName.endsWith('.csv') ||
    fileName.endsWith('.tsv') ||
    fileName.endsWith('.txt') ||
    file.type === 'text/csv' ||
    file.type === 'text/tab-separated-values' ||
    file.type === 'text/plain'
  ) {
    const text = await file.text();
    // Normalize tab delimiters to commas if TSV
    if (fileName.endsWith('.tsv') || text.includes('\t')) {
      const normalized = text
        .split(/\r?\n/)
        .map((line) => line.split('\t').map((f) => `"${f.replace(/"/g, '""')}"`).join(','))
        .join('\n');
      return { csvText: normalized, isReceipt: false };
    }
    return { csvText: text, isReceipt: false };
  }

  // 3. XML Spreadsheet / Excel 2003 XML (.xml or XML .xls)
  if (fileName.endsWith('.xml') || fileName.endsWith('.xls')) {
    try {
      const text = await file.text();
      if (text.includes('<Workbook') && text.includes('<Row>')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');
        const rows = Array.from(doc.getElementsByTagName('Row'));
        const csvRows: string[] = [];

        for (const row of rows) {
          const cells = Array.from(row.getElementsByTagName('Cell'));
          const rowVals = cells.map((cell) => {
            const data = cell.getElementsByTagName('Data')[0];
            return `"${(data?.textContent || '').replace(/"/g, '""')}"`;
          });
          if (rowVals.length > 0) {
            csvRows.push(rowVals.join(','));
          }
        }

        if (csvRows.length > 0) {
          return { csvText: csvRows.join('\n'), isReceipt: false };
        }
      }
    } catch {
      // Fall through to binary XLSX parser
    }
  }

  // 4. Excel (.xlsx) file
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Check for ZIP signature: 0x50, 0x4B, 0x03, 0x04 ("PK\x03\x04")
      if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
        const parsedCsv = await parseXlsxZipBytes(bytes);
        if (parsedCsv && parsedCsv.trim().length > 0) {
          return { csvText: parsedCsv, isReceipt: false };
        }
      }
    } catch (err) {
      console.warn('Binary XLSX extraction failed, checking fallback:', err);
    }
  }

  // Fallback: Attempt text decode
  const fallbackText = await file.text();
  return { csvText: fallbackText, isReceipt: false };
}

/**
 * Lightweight browser-native XLSX (PKZIP) unpacker using DecompressionStream.
 * Extracts sheet1.xml and sharedStrings.xml without any third party libraries.
 */
async function parseXlsxZipBytes(bytes: Uint8Array): Promise<string> {
  interface ZipEntry {
    name: string;
    dataOffset: number;
    compressedSize: number;
    uncompressedSize: number;
    compressionMethod: number;
  }

  const entries: ZipEntry[] = [];
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset < bytes.length - 30) {
    const sig = view.getUint32(offset, true);
    if (sig === 0x04034b50) {
      // Local File Header
      const compressionMethod = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const fileNameLength = view.getUint16(offset + 26, true);
      const extraFieldLength = view.getUint16(offset + 28, true);

      const nameBytes = bytes.slice(offset + 30, offset + 30 + fileNameLength);
      const name = new TextDecoder('utf-8').decode(nameBytes);
      const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

      entries.push({
        name,
        dataOffset,
        compressedSize,
        uncompressedSize,
        compressionMethod,
      });

      offset = dataOffset + compressedSize;
    } else {
      break;
    }
  }

  const decompressEntry = async (entry: ZipEntry): Promise<string> => {
    const rawSlice = bytes.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
    if (entry.compressionMethod === 0) {
      // Stored (no compression)
      return new TextDecoder('utf-8').decode(rawSlice);
    }
    if (entry.compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
      // Deflate
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(rawSlice);
      writer.close();
      const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
      return new TextDecoder('utf-8').decode(decompressedBuffer);
    }
    return '';
  };

  // Find sharedStrings and sheet1
  const sharedStringsEntry = entries.find((e) => e.name.endsWith('sharedStrings.xml'));
  const sheetEntry = entries.find(
    (e) => e.name.includes('sheet1.xml') || e.name.includes('worksheets/sheet')
  );

  if (!sheetEntry) return '';

  const sharedStrings: string[] = [];
  if (sharedStringsEntry) {
    const sstXml = await decompressEntry(sharedStringsEntry);
    if (sstXml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(sstXml, 'text/xml');
      const siNodes = Array.from(doc.getElementsByTagName('si'));
      for (const si of siNodes) {
        sharedStrings.push(si.textContent || '');
      }
    }
  }

  const sheetXml = await decompressEntry(sheetEntry);
  if (!sheetXml) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(sheetXml, 'text/xml');
  const rows = Array.from(doc.getElementsByTagName('row'));
  const csvLines: string[] = [];

  for (const r of rows) {
    const cells = Array.from(r.getElementsByTagName('c'));
    const rowFields: string[] = [];

    for (const c of cells) {
      const type = c.getAttribute('t');
      const valEl = c.getElementsByTagName('v')[0];
      const valText = valEl?.textContent || '';

      if (type === 's') {
        const sIndex = parseInt(valText, 10);
        const resolved = isNaN(sIndex) ? valText : sharedStrings[sIndex] || '';
        rowFields.push(`"${resolved.replace(/"/g, '""')}"`);
      } else {
        rowFields.push(`"${valText.replace(/"/g, '""')}"`);
      }
    }

    if (rowFields.length > 0) {
      csvLines.push(rowFields.join(','));
    }
  }

  return csvLines.join('\n');
}
