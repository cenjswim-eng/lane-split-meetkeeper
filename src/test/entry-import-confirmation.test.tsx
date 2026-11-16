import { fireEvent,render,screen,cleanup } from '@testing-library/react';
import { afterEach,it,expect,vi } from 'vitest';
import { EntryImportConfirmation } from '@/components/entry-import-confirmation';
vi.mock('@/lib/file-delivery',()=>({downloadFile:vi.fn(),exportFilename:(n:string)=>n}));
afterEach(cleanup);
const validation={errors:[],teams:1,athletes:2,entries:4,events:2,meet:'Copa',course:'L'};
const props={validation,file:new File(['SD3'],'entries.sd3'),hash:'abc123',delivered:true};
it('does not confirm until downloaded and externally checked with matching counts',()=>{
 const {rerender}=render(<EntryImportConfirmation {...props} delivered={false}/>);
 expect((screen.getByRole('button',{name:'Confirmar aceptación'}) as HTMLButtonElement).disabled).toBe(true);
 rerender(<EntryImportConfirmation {...props}/>);
 fireEvent.change(screen.getByLabelText('Versión de Meet Manager'),{target:{value:'8.0'}});
 fireEvent.change(screen.getByLabelText('Atletas importados en Meet Manager'),{target:{value:'2'}});
 fireEvent.change(screen.getByLabelText('Inscripciones importadas en Meet Manager'),{target:{value:'3'}});
 for(const check of screen.getAllByRole('checkbox'))fireEvent.click(check);
 expect((screen.getByRole('button',{name:'Confirmar aceptación'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Inscripciones importadas en Meet Manager'),{target:{value:'4'}});
 expect((screen.getByRole('button',{name:'Confirmar aceptación'}) as HTMLButtonElement).disabled).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Confirmar aceptación'}));
 expect(screen.getByRole('status').textContent).toBe('Aceptación declarada por el entrenador');
});
it('requires rejection details and never labels rejection accepted',()=>{
 render(<EntryImportConfirmation {...props}/>);
 expect((screen.getByRole('button',{name:'Registrar rechazo'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Observaciones de importación'),{target:{value:'Número de prueba no coincide'}});
 fireEvent.click(screen.getByRole('button',{name:'Registrar rechazo'}));
 expect(screen.getByRole('status').textContent).toBe('Rechazo declarado por el entrenador');
});