
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { timeSlots, timetableData, type TimetableEntry } from '@/lib/data';

const days = Object.keys(timetableData);

export default function TimetablePage() {
  const renderCellContent = (entry: TimetableEntry) => {
    if (!entry) {
      return null;
    }
    if (entry === 'Lunch' || entry === 'SPORTS') {
      return (
        <div className="font-semibold">{entry}</div>
      );
    }
    if (typeof entry === 'object' && entry !== null && 'subject' in entry) {
        if (entry.subject.includes('/')) {
             return (
                <div>
                    <p className="font-semibold">{entry.subject.split('/')[0]}</p>
                    <p className="text-xs text-muted-foreground">{entry.faculty.split('/')[0]}</p>
                    <p className="font-semibold mt-1">{entry.subject.split('/')[1]}</p>
                    <p className="text-xs text-muted-foreground">{entry.faculty.split('/')[1]}</p>
                </div>
            );
        }

        return (
          <div>
            <p className="font-semibold">{entry.subject}</p>
            <p className="text-xs text-muted-foreground">{entry.faculty}</p>
          </div>
        );
    }
    return null;
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Class Schedule</CardTitle>
        <CardDescription>
          An overview of the class schedule for the 5th semester.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-24 border-r text-center align-middle font-bold">
                  Day/Time
                </TableHead>
                {timeSlots.map((slot) => (
                  <TableHead key={slot.period} className="border-r text-center font-semibold">
                    <div>{slot.period}</div>
                    <div className="text-xs font-normal text-muted-foreground">{slot.time}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((day) => (
                <TableRow key={day}>
                  <TableHead className="w-24 border-r bg-muted/50 text-center font-bold">
                    {day}
                  </TableHead>
                  {timeSlots.map((slot, index) => {
                     const entry = timetableData[day][index];
                     const isLab = typeof entry === 'object' && entry !== null && entry.subject?.toUpperCase().includes('LAB');
                     const isSports = entry === 'SPORTS';
                     const isProject = typeof entry === 'object' && entry !== null && entry.subject?.toUpperCase().includes('PROJECT');

                     let colSpan = 1;
                     if(isLab || isSports || isProject) colSpan = 2;
                     
                     if (index > 0) {
                        const prevEntry = timetableData[day][index-1];
                        if (prevEntry) {
                            const prevIsLab = typeof prevEntry === 'object' && prevEntry !== null && prevEntry.subject?.toUpperCase().includes('LAB');
                            const prevIsProject = typeof prevEntry === 'object' && prevEntry !== null && prevEntry.subject?.toUpperCase().includes('PROJECT');
                            const prevIsSports = prevEntry === 'SPORTS';
                            if (prevIsLab || prevIsProject || prevIsSports) {
                                return null;
                            }
                        }
                     }
                     
                     if (day === 'SAT' && index >= 4) {
                        return <TableCell key={`${day}-${index}`} className="h-20 border-r p-2 text-center align-top"></TableCell>
                     }

                     return (
                        <TableCell 
                            key={`${day}-${index}`} 
                            className={`h-20 border-r p-2 text-center align-top ${entry === 'Lunch' || isSports ? 'bg-muted font-semibold align-middle' : ''}`}
                            colSpan={entry === 'Lunch' ? 1 : colSpan}
                        >
                           {renderCellContent(entry)}
                        </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}


