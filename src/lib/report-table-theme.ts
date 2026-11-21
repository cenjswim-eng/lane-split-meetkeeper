import type { jsPDF } from 'jspdf';
import autoTable,{type UserOptions} from 'jspdf-autotable';
import { reportPrint } from './report-layout';
import { contrastInk,type ReportBrand } from './report-brand';
const brands=new WeakMap<jsPDF,ReportBrand>();
const editorial=new WeakSet<jsPDF>();
export function setProfessionalReportTheme(doc:jsPDF){editorial.add(doc);}
export function setReportTableBrand(doc:jsPDF,brand?:ReportBrand){if(brand)brands.set(doc,brand);}
export function brandedTable(doc:jsPDF,options:UserOptions){const brand=brands.get(doc);if(editorial.has(doc)) options={...options,theme:'striped',margin:{left:14,right:14,top:30,bottom:30,...(typeof options.margin==='object'?options.margin:{})},styles:{font:'helvetica',fontSize:8.5,textColor:reportPrint.ink,cellPadding:3,overflow:'linebreak',lineWidth:0,...options.styles},alternateRowStyles:{fillColor:reportPrint.surface,...options.alternateRowStyles},headStyles:{cellPadding:3.5,fontStyle:'bold',...options.headStyles},rowPageBreak:'avoid'};return autoTable(doc,brand?{...options,styles:{...options.styles,lineColor:brand.secondary},headStyles:{...options.headStyles,fillColor:brand.primary,textColor:contrastInk(brand.primary)}}:options);}