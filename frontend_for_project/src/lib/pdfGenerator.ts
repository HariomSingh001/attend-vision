import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StudentStats {
  id: string;
  name: string;
  roll_number: string;
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
  status: string;
}

interface ReportData {
  summary: {
    total_students: number;
    total_records: number;
    overall_percentage: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    total_alerts: number;
  };
  student_statistics: StudentStats[];
  low_attendance_students: StudentStats[];
  daily_attendance: Array<{
    date: string;
    percentage: number;
  }>;
}

interface StudentReport {
  student: {
    name: string;
    roll_number: string;
    email: string;
    address?: string;
  };
  attendance_summary: {
    total_classes: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
    status: string;
  };
  monthly_attendance: Array<{
    month: string;
    present: number;
    total: number;
    percentage: number;
  }>;
  recent_records: Array<{
    date: string;
    status: string;
  }>;
}

export const generateOverallReportPDF = (reportData: ReportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Header with background
  doc.setFillColor(59, 130, 246); // Blue background
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('AttendVision', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Overall Attendance Report', pageWidth / 2, 28, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  yPos = 50;

  // Generated date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPos);
  yPos += 10;

  // Summary Statistics Section
  doc.setFillColor(243, 244, 246); // Light gray background
  doc.rect(14, yPos, pageWidth - 28, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary Statistics', 16, yPos + 6);
  yPos += 15;

  // Summary cards in a grid
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const cardWidth = (pageWidth - 28 - 15) / 4; // 4 cards with spacing
  const cardHeight = 25;
  const cardSpacing = 5;
  
  const summaryCards = [
    { label: 'Total Students', value: reportData.summary.total_students, color: [59, 130, 246] as [number, number, number] },
    { label: 'Overall Attendance', value: `${reportData.summary.overall_percentage}%`, color: [16, 185, 129] as [number, number, number] },
    { label: 'Low Attendance', value: reportData.low_attendance_students.length, color: [239, 68, 68] as [number, number, number] },
    { label: 'Alerts Sent', value: reportData.summary.total_alerts, color: [245, 158, 11] as [number, number, number] },
  ];

  summaryCards.forEach((card, index) => {
    const xPos = 14 + (cardWidth + cardSpacing) * index;
    
    // Card background
    doc.setFillColor(card.color[0], card.color[1], card.color[2]);
    doc.roundedRect(xPos, yPos, cardWidth, cardHeight, 3, 3, 'F');
    
    // Card text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(card.label, xPos + cardWidth / 2, yPos + 8, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(String(card.value), xPos + cardWidth / 2, yPos + 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });

  doc.setTextColor(0, 0, 0);
  yPos += cardHeight + 15;

  // Attendance Breakdown
  doc.setFillColor(243, 244, 246);
  doc.rect(14, yPos, pageWidth - 28, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Attendance Breakdown', 16, yPos + 6);
  yPos += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const breakdownData = [
    ['Status', 'Count', 'Percentage'],
    ['Present', reportData.summary.present_count, `${((reportData.summary.present_count / reportData.summary.total_records) * 100).toFixed(1)}%`],
    ['Absent', reportData.summary.absent_count, `${((reportData.summary.absent_count / reportData.summary.total_records) * 100).toFixed(1)}%`],
    ['Late', reportData.summary.late_count, `${((reportData.summary.late_count / reportData.summary.total_records) * 100).toFixed(1)}%`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [breakdownData[0]],
    body: breakdownData.slice(1),
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 60, halign: 'center' },
      2: { cellWidth: 60, halign: 'center' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Student Performance Table
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(243, 244, 246);
  doc.rect(14, yPos, pageWidth - 28, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Student Performance', 16, yPos + 6);
  yPos += 15;

  const studentTableData = reportData.student_statistics.map(student => [
    student.roll_number,
    student.name,
    student.total_classes,
    student.present,
    student.absent,
    `${student.percentage}%`,
    student.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Roll No', 'Name', 'Total', 'Present', 'Absent', 'Attendance', 'Status']],
    body: studentTableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 50 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const percentage = parseFloat(data.cell.text[0]);
        if (percentage >= 75) {
          data.cell.styles.textColor = [22, 163, 74]; // Green
          data.cell.styles.fontStyle = 'bold';
        } else if (percentage >= 60) {
          data.cell.styles.textColor = [234, 179, 8]; // Yellow
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [220, 38, 38]; // Red
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.section === 'body' && data.column.index === 6) {
        const status = data.cell.text[0].toLowerCase();
        if (status === 'good') {
          data.cell.styles.fillColor = [220, 252, 231]; // Light green
          data.cell.styles.textColor = [22, 163, 74];
        } else if (status === 'warning') {
          data.cell.styles.fillColor = [254, 249, 195]; // Light yellow
          data.cell.styles.textColor = [234, 179, 8];
        } else if (status === 'critical') {
          data.cell.styles.fillColor = [254, 226, 226]; // Light red
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Low Attendance Alert Section
  if (reportData.low_attendance_students.length > 0) {
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(254, 226, 226); // Light red
    doc.rect(14, yPos, pageWidth - 28, 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('⚠ Low Attendance Alert', 16, yPos + 6);
    doc.setTextColor(0, 0, 0);
    yPos += 15;

    const lowAttendanceData = reportData.low_attendance_students.map(student => [
      student.roll_number,
      student.name,
      `${student.present}/${student.total_classes}`,
      `${student.percentage}%`,
      student.status.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Roll No', 'Name', 'Classes', 'Attendance', 'Status']],
      body: lowAttendanceData,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
      bodyStyles: { fillColor: [254, 242, 242] },
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'AttendVision - Attendance Management System',
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Save the PDF
  doc.save(`attendance-report-overall-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateStudentReportPDF = (studentReport: StudentReport) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Header with background
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('AttendVision', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Student Attendance Report', pageWidth / 2, 28, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  yPos = 50;

  // Generated date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPos);
  yPos += 10;

  // Student Information Section
  doc.setFillColor(243, 244, 246);
  doc.rect(14, yPos, pageWidth - 28, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Student Information', 16, yPos + 6);
  yPos += 15;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${studentReport.student.name}`, 20, yPos);
  yPos += 7;
  doc.text(`Roll Number: ${studentReport.student.roll_number}`, 20, yPos);
  yPos += 7;
  doc.text(`Email: ${studentReport.student.email}`, 20, yPos);
  yPos += 7;
  if (studentReport.student.address) {
    doc.text(`Address: ${studentReport.student.address}`, 20, yPos);
    yPos += 7;
  }
  yPos += 8;

  // Attendance Summary with visual cards
  doc.setFillColor(243, 244, 246);
  doc.rect(14, yPos, pageWidth - 28, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Attendance Summary', 16, yPos + 6);
  yPos += 15;

  const summary = studentReport.attendance_summary;
  const statusColor: [number, number, number] = 
    summary.status === 'good' ? [16, 185, 129] :
    summary.status === 'warning' ? [245, 158, 11] :
    [239, 68, 68];

  // Large percentage display
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(14, yPos, 60, 30, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(`${summary.percentage}%`, 44, yPos + 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(summary.status.toUpperCase(), 44, yPos + 27, { align: 'center' });

  // Summary details
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const detailsX = 80;
  doc.text(`Total Classes: ${summary.total_classes}`, detailsX, yPos + 8);
  doc.setTextColor(22, 163, 74);
  doc.text(`Present: ${summary.present}`, detailsX, yPos + 15);
  doc.setTextColor(220, 38, 38);
  doc.text(`Absent: ${summary.absent}`, detailsX, yPos + 22);
  doc.setTextColor(245, 158, 11);
  doc.text(`Late: ${summary.late}`, detailsX, yPos + 29);
  doc.setTextColor(0, 0, 0);

  yPos += 40;

  // Monthly Attendance Table
  if (studentReport.monthly_attendance.length > 0) {
    doc.setFillColor(243, 244, 246);
    doc.rect(14, yPos, pageWidth - 28, 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Monthly Breakdown', 16, yPos + 6);
    yPos += 15;

    const monthlyData = studentReport.monthly_attendance.map(month => [
      month.month,
      month.present,
      month.total,
      `${month.percentage}%`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Month', 'Present', 'Total', 'Percentage']],
      body: monthlyData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 50, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const percentage = parseFloat(data.cell.text[0]);
          if (percentage >= 75) {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else if (percentage >= 60) {
            data.cell.styles.textColor = [234, 179, 8];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Recent Attendance Records
  if (studentReport.recent_records.length > 0) {
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(243, 244, 246);
    doc.rect(14, yPos, pageWidth - 28, 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Recent Attendance Records', 16, yPos + 6);
    yPos += 15;

    const recentData = studentReport.recent_records.slice(0, 15).map(record => [
      record.date,
      record.status.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Status']],
      body: recentData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 80, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const status = data.cell.text[0].toLowerCase();
          if (status === 'present') {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'absent') {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'late') {
            data.cell.styles.fillColor = [254, 249, 195];
            data.cell.styles.textColor = [234, 179, 8];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'AttendVision - Attendance Management System',
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `attendance-report-${studentReport.student.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
