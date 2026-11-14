const PDFDocument = require('pdfkit');

// Renders a landscape A4 certificate and resolves with the PDF as a Buffer.
function renderCertificate({ certId, studentName, courseTitle, instructorName, issuedAt, verifyUrl }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50, info: { Title: `Certificate ${certId}`, Author: 'LearnSphere' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    doc.rect(25, 25, W - 50, H - 50).lineWidth(3).stroke('#1e3a8a');
    doc.rect(35, 35, W - 70, H - 70).lineWidth(1).stroke('#93c5fd');

    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(14).text('LEARNSPHERE', 0, 70, { align: 'center', characterSpacing: 4 });
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(38).text('Certificate of Completion', 0, 105, { align: 'center' });
    doc.font('Helvetica').fontSize(14).fillColor('#4b5563').text('This is to certify that', 0, 175, { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(34).fillColor('#1e3a8a').text(studentName, 60, 205, { align: 'center', width: W - 120 });
    doc.moveTo(W / 2 - 160, 255).lineTo(W / 2 + 160, 255).lineWidth(1).stroke('#9ca3af');
    doc.font('Helvetica').fontSize(14).fillColor('#4b5563').text('has successfully completed the course', 0, 272, { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#111827').text(courseTitle, 70, 302, { align: 'center', width: W - 140 });

    const y = H - 130;
    doc.font('Helvetica').fontSize(11).fillColor('#374151');
    doc.text(`Instructor: ${instructorName}`, 70, y, { width: 260 });
    doc.text(`Issued: ${new Date(issuedAt).toISOString().slice(0, 10)}`, 70, y + 18, { width: 260 });
    doc.text(`Certificate ID: ${certId}`, W - 330, y, { width: 260, align: 'right' });
    doc.fontSize(9).fillColor('#2563eb').text(`Verify: ${verifyUrl}`, W - 400, y + 18, { width: 330, align: 'right' });
    doc.end();
  });
}

module.exports = { renderCertificate };
