import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
 data=json.loads(Path('/tmp/browser/achievements/session.json').read_text())
 out=Path('/tmp/browser/achievements');out.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  context=await browser.new_context(viewport={'width':1280,'height':1800},accept_downloads=True)
  page=await context.new_page()
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://localhost:8080')
  keys=await page.evaluate('Object.keys(localStorage).filter(k=>k.startsWith("sb-")&&k.endsWith("-auth-token"))')
  # Discover the generated client's project key from its public configuration, not any secret dump.
  import os
  project=os.environ.get('VITE_SUPABASE_PROJECT_ID') or os.environ.get('SUPABASE_PROJECT_ID')
  if not project:
   from urllib.parse import urlparse
   project=urlparse(os.environ['VITE_SUPABASE_URL']).hostname.split('.')[0]
  key=keys[0] if keys else f'sb-{project}-auth-token'
  await page.evaluate('([k,v])=>localStorage.setItem(k,v)',[key,json.dumps(data['session'])])
  await page.goto('http://localhost:8080/achievements')
  await page.get_by_role('heading',name='Logros del club',exact=True).wait_for()
  await page.get_by_text('Primera marca',exact=True).first.wait_for()
  assert await page.locator('article').count()==3
  await page.screenshot(path=str(out/'1_logros.png'))
  await page.get_by_role('button',name='Compartir logro',exact=True).first.click()
  await page.get_by_role('button',name='Preparar imagen vertical').click()
  await page.get_by_alt_text('Vista previa del logro para compartir').wait_for()
  await page.screenshot(path=str(out/'2_compartir.png'))
  async with page.expect_download() as download:
   await page.get_by_role('button',name='Descargar imagen',exact=True).click()
  await (await download.value).save_as(str(out/'logro.png'))
  await page.keyboard.press('Escape')
  await page.goto('http://localhost:8080/dashboard')
  await page.get_by_role('heading',name='Logros recientes').wait_for()
  await page.goto('http://localhost:8080/athletes/'+data['athlete'])
  await page.get_by_role('heading',name='Línea de tiempo de logros').wait_for()
  await page.get_by_role('button',name='PDF de seguimiento',exact=True).click()
  await page.get_by_role('button',name='Preparar PDF',exact=True).click()
  async with page.expect_download() as download:
   await page.get_by_role('button',name='Descargar PDF',exact=True).click()
  await (await download.value).save_as(str(out/'seguimiento.pdf'))
  await page.keyboard.press('Escape')
  await page.set_viewport_size({'width':390,'height':844})
  await page.goto('http://localhost:8080/achievements')
  await page.get_by_role('heading',name='Logros del club',exact=True).wait_for()
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  await page.screenshot(path=str(out/'3_movil.png'))
  assert not errors,errors
  await browser.close()

asyncio.run(main())