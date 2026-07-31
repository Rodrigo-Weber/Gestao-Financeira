import { expect, test, type Page } from '@playwright/test'

async function enterDemo(page: Page) {
  await page.goto('/')

  const demoButton = page.getByRole('button', { name: /Explorar demonstra/i })
  if (await demoButton.isVisible().catch(() => false)) {
    await demoButton.click()
  }

  await expect(page.locator('.sidebar')).toBeVisible()
}

async function openNavigation(page: Page, label: RegExp) {
  await page.locator('.sidebar nav').getByRole('button', { name: label }).click()
}

test.beforeEach(async ({ page }) => {
  await enterDemo(page)
})

test('abre cartões e apresenta limites e faturas', async ({ page }) => {
  await openNavigation(page, /Cart/)

  await expect(page.getByText(/Limite ocupado/i).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /Faturas sincronizadas/i })).toBeVisible()
})

test('permite revisar padrões recorrentes', async ({ page }) => {
  await openNavigation(page, /Recorrentes/i)

  await expect(page.getByRole('heading', { name: /Gastos recorrentes/i })).toBeVisible()
  await expect(page.getByText(/recorr/i).first()).toBeVisible()
})

test('abre calendário financeiro e conciliação', async ({ page }) => {
  await openNavigation(page, /Calend/)
  await expect(page.getByRole('heading', { name: /Calendário e comparativos/i })).toBeVisible()

  await openNavigation(page, /Concilia/)
  await expect(page.getByRole('heading', { name: /Central de conciliação/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Instituição x sistema/i })).toBeVisible()
})
