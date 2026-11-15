import{it,expect}from'vitest';import{formatGarageDate}from'./garage-date';
it('preserves producer date-only fields, including dates west of UTC',()=>{expect(formatGarageDate('2026-10-20')).toBe('20 Oct 2026');expect(formatGarageDate('2026-01-01')).toBe('1 Jan 2026')});
it('does not convert lifecycle instants into date-only fields',()=>{for(const value of ['2026-10-20T00:00:00Z','2026-10-20T23:30:00Z'])expect(formatGarageDate(value)).toBe(new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}))});
