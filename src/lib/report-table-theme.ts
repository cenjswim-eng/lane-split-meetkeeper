import type { jsPDF } from 'jspdf';
import autoTable,{type UserOptions} from 'jspdf-autotable';
import { contrastInk,type ReportBrand } from './report-brand';
const brands=new WeakMap<jsPDF,ReportBrand>();
export function setReportTableBrand(doc:jsPDF,brand?:ReportBrand){if(brand)brands.set(doc,brand);}
export function brandedTable(doc:jsPDF,options:UserOptions){const brand=brands.get(doc);return autoTable(doc,brand?{...options,styles:{...options.styles,lineColor:brand.secondary},headStyles:{...options.headStyles,fillColor:brand.primary,textColor:contrastInk(brand.primary)}}:options);}