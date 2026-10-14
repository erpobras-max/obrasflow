import { expect, test } from "@playwright/test";

test.describe("Acesso público", () => {
  test("exibe o acesso da equipe com campos identificados", async ({ page }) => {
    await page.goto("/auth");

    await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("type", "email");
    await expect(page.getByRole("textbox", { name: "Senha" })).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    await expect(page.getByRole("button", { name: "Entrar no sistema" })).toBeVisible();
  });

  test("alterna para cliente e aplica o formato de CPF sem enviar dados", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("tab", { name: "Cliente" }).click();

    const documento = page.getByLabel("CPF ou CNPJ");
    await expect(documento).toHaveAttribute("inputmode", "numeric");
    await documento.fill("52998224725");
    await expect(documento).toHaveValue("529.982.247-25");
    await expect(page.getByRole("button", { name: "Acessar área do cliente" })).toBeVisible();
  });

  test("direciona rota interna protegida ao acesso", async ({ page }) => {
    await page.goto("/imobiliaria/vendas");
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible();
  });

  test("redireciona movimentação sem sessão ao login e preserva os parâmetros do QR", async ({
    page,
  }) => {
    await page.goto("/estoque/movimentacao?produto=qr-token-teste");

    await expect(page).toHaveURL(/\/auth\?/);
    await expect(page).toHaveURL(/redirect=.*estoque.*movimentacao/);
    await expect(page).toHaveURL(/produto.*qr-token-teste/);
    await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible();
  });
});
