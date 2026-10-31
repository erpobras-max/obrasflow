import { expect, test } from '@playwright/test'

const email = process.env.E2E_EMAIL
const senha = process.env.E2E_PASSWORD
const permiteMutacao = process.env.E2E_PROPOSTAS_MUTATION === 'true'

test.describe('Editor comercial único', () => {
  test.skip(!email || !senha || !permiteMutacao, 'Requer E2E_EMAIL, E2E_PASSWORD e E2E_PROPOSTAS_MUTATION=true em ambiente controlado.')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth')
    await page.getByLabel('E-mail').fill(email!)
    await page.getByRole('textbox', { name: 'Senha' }).fill(senha!)
    await page.getByRole('button', { name: 'Entrar no sistema' }).click()
    await page.waitForURL((url) => !url.pathname.endsWith('/auth'))
  })

  test('cria, persiste, publica, consulta histórico e mantém somente o editor novo', async ({ page }) => {
    const errosConsole: string[] = []
    page.on('console', (mensagem) => {
      if (mensagem.type() === 'error') errosConsole.push(mensagem.text())
    })

    await page.goto('/comercial/propostas')
    await expect(page.getByRole('button', { name: 'Nova proposta' })).toBeVisible()
    await expect(page.getByText('Abrir Editor Comercial')).toHaveCount(0)

    await page.getByRole('button', { name: 'Nova proposta' }).click()
    const seletores = page.getByRole('combobox')
    await seletores.nth(0).click()
    const primeiraObra = page.getByRole('option').first()
    test.skip(await primeiraObra.count() === 0, 'Ambiente controlado sem obra/orçamento/revisão para o cenário.')
    await primeiraObra.click()
    await seletores.nth(1).click()
    await page.getByRole('option').first().click()
    await seletores.nth(2).click()
    await page.getByRole('option').first().click()
    await page.getByRole('button', { name: 'Criar e abrir editor' }).click()

    await expect(page.getByText(/Rascunho Comercial/)).toBeVisible()
    await page.getByRole('button', { name: 'Salvar Rascunho' }).click()
    await expect(page.getByText('Rascunho salvo.')).toBeVisible()
    await page.reload()
    await expect(page.getByText(/Rascunho Comercial/)).toBeVisible()

    await page.getByRole('button', { name: 'Publicar Nova Revisão' }).click()
    await expect(page.getByText(/enviada \(somente leitura\)/i)).toBeVisible()
    await page.getByRole('button', { name: 'Revisões' }).click()
    await expect(page.getByRole('heading', { name: 'Histórico de Revisões da Proposta' })).toBeVisible()
    await expect(page.getByText('enviada')).toBeVisible()

    await page.getByRole('button', { name: 'Fechar' }).click()
    await expect(page.getByRole('button', { name: 'Imprimir / PDF' })).toBeVisible()
    expect(errosConsole).toEqual([])
  })
})
