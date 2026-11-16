import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{it,expect,vi}from'vitest';import{writeFileSync,readFileSync,mkdirSync}from'node:fs';
vi.mock('./PushAlertsButton',()=>({PushAlertsButton:()=>null}));
vi.mock('next/link',()=>({default:({children,href,...p}:any)=><a href={href} {...p}>{children}</a>}));
import{StaffShell}from'./StaffShell';import{DashboardView}from'./DashboardView';import{ThemeStyle}from'./ThemeStyle';
it('captures actual Today shell with fictional fixtures and limits width change to Today',()=>{
 const root='/downloads/ad-service-correction-20261116';mkdirSync(root,{recursive:true});
 const props={today:'2026-11-16',now:new Date('2026-11-16T07:30:00Z'),revenueToday:0,tiles:{bookings:0,active:0,delivered:0,walkins:0,staffPresent:0},floor:{arriving:0,working:0,ready:0,delivered:0},counts:{failedPayments:0,unpaidDelivered:0,pendingApprovals:0,staleJobs:0,pendingPayments:0,expiringMemberships:1,lowStock:0,pendingPapers:0},onOpen:()=>{}};
 const html=renderToStaticMarkup(<StaffShell pathname="/dashboard" office role="admin" who="Local fixture" home="/dashboard" onSignOut={()=>{}}><DashboardView {...props}/></StaffShell>);
 const paths=['src/app/globals.css','src/experience/experience.css','src/experience/shell.css','src/experience/float.css','src/experience/orizon.css','src/experience/canvas.css','src/experience/shell-v2.css','src/experience/polish.css','src/experience/actions.css','src/experience/garage.css'];
 const css=paths.map(p=>readFileSync(p,'utf8')).join('\n');
 const font=`@font-face{font-family:Inter;src:url(file://${process.cwd()}/src/fonts/inter-latin-wght-normal.woff2)}@font-face{font-family:Montserrat;src:url(file://${process.cwd()}/src/fonts/montserrat-latin-wght-normal.woff2)}:root{--ad-font-display:Montserrat;--ad-font-body:Inter;--ad-font-data:Inter}`;
 const label='<div style="position:fixed;z-index:50;bottom:0;left:0;padding:4px 12px;font:11px system-ui;background:#fff0ca;color:#665117">LOCAL COMPONENT PREVIEW · FICTIONAL COUNTS · NOT LIVE</div>';
 for(const mode of['light','night'])writeFileSync(`${root}/admin-today-${mode}.html`,`<!doctype html><html data-theme="${mode}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${renderToStaticMarkup(<ThemeStyle/>)}<style>${css}\n${font}</style>${html}${label}</html>`);
 expect(css).toContain('.ax-main:has(> .ax-dash)');expect(html).toContain('Good afternoon');
});
