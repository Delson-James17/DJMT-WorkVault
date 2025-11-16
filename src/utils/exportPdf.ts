import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportToPdf(elementId: string, filename = 'time-tracker.pdf') {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('element not found');

  const canvas = await html2canvas(el, { scale: 2 });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF('p', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pageWidth - 40;
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  let heightLeft = imgHeight;
  let y = 20;

  pdf.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    pdf.addPage();
    y = 20 - heightLeft;
    pdf.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
