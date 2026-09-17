with open('src/components/propostas/proposta-impressao.tsx','r',encoding='utf-8') as f: s=f.read()
old = '        <div><h1 className="text-lg font-bold">{empresa?.nome_fantasia||empresa?.razao_social||"Empresa"}</h1><p>{empresa?.razao_social}</p><p>CNPJ: {empresa?.cnpj||"Não informado"}{empresa?.inscricao_estadual?` · IE: ${empresa.inscricao_estadual}`:""}</p><p>{enderecoEmpresa(empresa)}</p><p>{[empresa?.telefone,empresa?.email].filter(Boolean).join(" · ")}</p></div><div className="text-right">'
new = '        <div>\n          <h1 className="text-lg font-bold">{empresa?.nome_fantasia||empresa?.razao_social||"Empresa"}</h1>\n          <p>{empresa?.razao_social}</p>\n          <p>CNPJ: {empresa?.cnpj||"Não informado"}{empresa?.inscricao_estadual?` · IE: ${empresa.inscricao_estadual}`:""}</p>\n          <p>{enderecoEmpresa(empresa)}</p>\n          <p>{[empresa?.telefone,empresa?.email].filter(Boolean).join(" · ")}</p>\n        </div>\n        <div className="text-right">'
s = s.replace(old, new)
with open('src/components/propostas/proposta-impressao.tsx','w',encoding='utf-8') as f: f.write(s)
print('done', 'fixed' if old not in s else 'no change')
