import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 out=Path('/tmp/browser/shared-reports');data=json.loads((out/'session.json').read_text())
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  context=await browser.new_context(viewport={'width':1280,'height':1800},accept_downloads=True)
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://localhost:8080')
  key='sb-'+os.environ['SUPABASE_PROJECT_ID']+'-auth-token'
  await page.evaluate('([k,v])=>localStorage.setItem(k,v)',[key,json.dumps(data['session'])])
  await page.goto('http://localhost:8080/brand')
  await page.get_by_label('Nombre oficial',exact=True).fill('Club Marca Privada')
  await page.get_by_label('Código principal',exact=True).fill('#ffffff')
  await page.get_by_label('Código secundario',exact=True).fill('#3cc8e0')
  logo=out/'logo.svg';logo.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="#3cc8e0"/><text x="25" y="65" font-size="40">CLUB MARCA</text></svg>')
  await page.get_by_label('Logo de la marca',exact=True).set_input_files(str(logo))
  await page.get_by_text('Logo guardado.',exact=True).wait_for()
  await page.get_by_role('button',name='Guardar marca',exact=True).click()
  await page.get_by_text('Marca guardada.',exact=True).wait_for()
  await page.reload()
  await page.get_by_alt_text('Vista previa del logo del club').wait_for()
  assert await page.get_by_label('Código principal',exact=True).input_value()=='#ffffff'
  await page.screenshot(path=str(out/'1_marca.png'))
  await page.goto('http://localhost:8080/athletes/'+data['athlete'])
  await page.get_by_role('button',name='PDF de seguimiento',exact=True).click()
  await page.get_by_role('button',name='Preparar PDF',exact=True).click()
  await page.get_by_label('Vista previa del PDF',exact=True).wait_for()
  async with page.expect_download() as dl:await page.get_by_role('button',name='Descargar PDF',exact=True).click()
  await (await dl.value).save_as(str(out/'private.pdf'))
  await page.keyboard.press('Escape')
  await page.get_by_role('button',name='Compartir reporte',exact=True).click()
  await page.get_by_role('button',name='Preparar vista previa',exact=True).click()
  await page.get_by_label('Vista previa del PDF',exact=True).wait_for()
  await page.get_by_role('button',name='Confirmar y crear enlace',exact=True).click()
  await page.wait_for_timeout(1500)
  print(await page.locator('[data-sonner-toast]').all_text_contents())
  await page.screenshot(path=str(out/'error_share.png'))
  href=await page.get_by_role('link',name='Enviar por WhatsApp',exact=True).get_attribute('href')
  from urllib.parse import unquote
  share=unquote(href).split('\n')[-1]
  assert '/share/' in share
  public=await browser.new_context(viewport={'width':390,'height':844})
  viewer=await public.new_page()
  await viewer.goto(share)
  await viewer.get_by_role('heading',name='Reporte individual',exact=True).wait_for()
  await viewer.wait_for_function('document.querySelector("canvas")?.width > 300')
  await viewer.wait_for_timeout(1200)
  assert await viewer.evaluate('document.documentElement.scrollWidth<=innerWidth')
  await viewer.screenshot(path=str(out/'2_publico.png'))
  token=share.split('/')[-1]
  res=await viewer.request.get('http://localhost:8080/report-file/'+token)
  assert res.status==200
  (out/'public.pdf').write_bytes(await res.body())
  await page.goto('http://localhost:8080/reports')
  await page.get_by_role('heading',name='Enlaces compartidos',exact=True).wait_for()
  await page.get_by_role('button',name='Revocar enlace',exact=True).click()
  await page.get_by_text('Enlace revocado.',exact=True).wait_for()
  await viewer.reload()
  await viewer.get_by_role('heading',name='Reporte no disponible',exact=True).wait_for()
  assert (await viewer.request.get('http://localhost:8080/report-file/'+token)).status==404
  assert not errors,errors
  print('Brand save, PDF preview, anonymous download and revocation verified')
  await browser.close()
asyncio.run(main())