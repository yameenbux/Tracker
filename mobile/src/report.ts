// Turns the report into a PDF on the phone and opens the share sheet, so the person decides where it goes.
// The file is written to the app's cache, which is cleared on the next launch (see clearCache).
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { buildReportHtml, type ReportInput } from './core/report';

export async function shareReport(input: ReportInput): Promise<void> {
  const { uri } = await printToFileAsync({ html: buildReportHtml(input) });
  if (!(await isAvailableAsync())) throw new Error('Sharing isn’t available on this device.');
  await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Weight report' });
}
