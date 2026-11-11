# Área administrativa: contrato com o backend

O front da área administrativa está pronto. **Nada é simulado**: se um endpoint não existir, a tela mostra "Aguardando integração com o backend" e o endpoint que falta. Todo acesso passa por `Api.admin.*` em `frontend/assets/js/api.js` e vale a convenção de `docs/API.md` (cookie de sessão, erros `{ "mensagem": "..." }`).

## Como o front trata as respostas
- **403**: mostra "Acesso negado" (ou o aviso de permissão numa ação).
- **Funcionalidade ainda não implementada**: se uma rota `/admin/*` responder **501**, **404 sem `mensagem`** (o 404 padrão de "rota inexistente" dos frameworks) ou o corpo `{ "codigo": "ENDPOINT_NAO_IMPLEMENTADO" }`, a tela esconde a tabela e mostra o aviso "Funcionalidade em implantação". O aviso é gerado só por JavaScript; não existe aviso fixo nos HTML. Qualquer outro erro (404 **com** `mensagem`, como "Usuário não encontrado", 500, falha de rede) aparece como erro real, com "Tentar novamente", e nunca é confundido com "lista vazia".
- Com `USE_MOCK: true`, as telas administrativas funcionam **sem nenhum registro de exemplo**: abrem vazias, só com os dois níveis de acesso (Administrador e Usuário comum) para os formulários funcionarem. Tudo o que for cadastrado (usuários, categorias, autorizações etc.) fica apenas na aba aberta, via `sessionStorage`, e some ao fechá-la. O bloco `MOCK ADMIN` no fim de `frontend/assets/js/api.js` pode ser apagado quando o backend existir. Com `USE_MOCK: false` nada disso é usado.
- A interface **não cita backend nem endpoints**. Para quem desenvolve, `APP_CONFIG.MODO_DEV = true` (em `config.js`) mostra qual endpoint falta; o detalhe também fica no atributo `data-endpoint` do aviso e no `console.info`.

## Permissões
`GET /me` devolve `permissoes` (lista de códigos). O front usa apenas para mostrar/ocultar telas e botões. **O servidor deve validar cada rota.**

| Código | Libera |
|---|---|
| `documentos:visualizar` | item Documentos do menu admin, a página de documentos e os dados de documentos do painel |
| `documentos:cadastrar` / `editar` / `excluir` | botões de cadastro, edição e exclusão (já existentes) |
| `documentos:permissoes` | classificar documentos e gerenciar quem pode visualizar os confidenciais (Administração > Documentos > Acesso) |
| `usuarios:gerenciar` | Usuários e Perfis e permissões |
| `auditoria:consultar` | Auditoria e histórico por documento |
| `configuracoes:administrar` | Categorias e Configurações |

Entrar na área admin exige ao menos uma de: `usuarios:gerenciar`, `auditoria:consultar`, `configuracoes:administrar`, `documentos:permissoes`. Os perfis (administrador, gestor, editor, visualizador...) **vêm do backend** em `GET /admin/perfis`; o front não fixa nomes de perfil.

## Endpoints
Listas paginadas seguem `{ itens, total, pagina, limite, totalPaginas }`; o front pede `limite=20`.

| Situação | Método e rota | Corpo / parâmetros | Resposta |
|---|---|---|---|
| ✅ já no contrato | `GET /documentos?categoria=&busca=&pagina=&limite=` | n/a | lista de documentos |
| ✅ já no contrato | `GET/PATCH/DELETE /documentos/:id`, `POST /documentos` | ver `API.md` | n/a |
| ✅ já no contrato | `GET /categorias` | n/a | `[{ id, nome, descricao, total }]` |
| ✅ já no contrato | `GET /me` | n/a | com `permissoes` |
| ⏳ extensão | `GET /documentos` | novos filtros `responsavel` (nome), `de` e `ate` (`YYYY-MM-DD`) | igual |
| ⏳ extensão | `GET /categorias?incluirInativas=1` | n/a | inclui `ativa` (boolean) e respeita a ordem definida |
| ⏳ novo | `GET /admin/resumo` | n/a | `{ usuarios: { total, ativos, bloqueados }, atividadesRecentes: [Atividade] }` |
| ⏳ novo | `GET /admin/usuarios` | `busca`, `perfil` (id), `departamento`, `situacao` (`ativo`/`bloqueado`), `pagina`, `limite` | lista de `Usuario` |
| ⏳ novo | `GET /admin/usuarios/:id` | n/a | `Usuario` completo |
| ⏳ novo | `POST /admin/usuarios` | `{ nome, email, cpf, telefone, cargo, departamento, perfilId }` | 201. Envia e-mail de convite para a pessoa definir a senha |
| ⏳ novo | `PATCH /admin/usuarios/:id` | `{ nome, telefone, cargo, departamento, perfilId }` | 200 |
| ⏳ novo | `POST /admin/usuarios/:id/bloquear` e `/reativar` | n/a | 204 |
| ⏳ novo | `GET /admin/perfis` | n/a | `[{ id, nome, descricao, permissoes: [código], usuarios }]` |
| ⏳ novo | `PUT /admin/perfis/:id/permissoes` | `{ permissoes: [código] }` | 204 |
| ⏳ novo | `POST /admin/categorias` | `{ nome, descricao }` | 201 |
| ⏳ novo | `PATCH /admin/categorias/:id` | `{ nome, descricao }` ou `{ ativa }` | 200. Desativar não pode desvincular documentos |
| ⏳ novo | `PUT /admin/categorias/ordem` | `{ ids: [id] }` na ordem desejada | 204 |
| ⏳ novo | `GET /admin/auditoria` | `usuario`, `acao`, `documento`, `de`, `ate`, `pagina`, `limite` | lista de `Atividade` |
| ⏳ novo | `GET/PUT /admin/configuracoes` | `{ limiteUploadMb, tiposArquivo: [extensão] }` | idem |

`Usuario`: `{ id, nome, email, cpf (mascarado), telefone, cargo, departamento, perfilId, perfil (nome), situacao ("ativo"|"bloqueado"), ultimoAcesso, criadoEm }`.
`Atividade`: `{ id, quando (ISO 8601), usuario (nome), acao, recurso: { tipo, id, nome }, detalhes }`.
Códigos de `acao` usados nos filtros: `login`, `documento.cadastro`, `documento.edicao`, `documento.exclusao`, `documento.download`, `usuario.cadastro`, `usuario.edicao`, `permissao.alteracao`, `usuario.bloqueio`, `usuario.reativacao`.

## Regras para o back
- Os registros de auditoria são **somente leitura** e gerados pelo servidor; o front não grava eventos.
- Não permitir que o último administrador seja bloqueado ou perca a permissão de gerenciar usuários.
- Documentos: não excluir sem checar permissão; o histórico deve registrar quem fez o quê.
- Configurações: apenas parâmetros gerais. Autenticação, armazenamento e infraestrutura ficam fora da tela.

## Estado da integração no front
| Tela | Integrada hoje | Depende do backend |
|---|---|---|
| Painel | documentos recentes, total e por categoria | usuários e atividades (`/admin/resumo`) |
| Usuários | n/a | tudo (`/admin/usuarios*`, `/admin/perfis` para os filtros) |
| Perfis e permissões | n/a | tudo (`/admin/perfis*`) |
| Documentos | listagem, busca, categoria, cadastro, edição, exclusão | filtros responsável e data, histórico (`/admin/auditoria`) |
| Categorias | listagem | criar, editar, desativar, ordenar |
| Auditoria | n/a | tudo (`/admin/auditoria`) |
| Configurações | n/a | tudo (`/admin/configuracoes`) |

---

# Controle de acesso a documentos confidenciais

## Regra de negócio (requisito da instituição)
| Perfil | O que pode |
|---|---|
| **Administrador** | Define a classificação de cada documento e gerencia quem pode visualizar os confidenciais: **conceder, alterar e revogar** autorizações para usuários ou grupos |
| **Usuário comum** | Vê os documentos de **acesso geral** e os **confidenciais para os quais foi autorizado**. Não altera permissões |

Os perfis continuam vindo do backend. O front reconhece o administrador pela permissão **`documentos:permissoes`** ("Gerenciar acesso aos documentos"), em `GET /me` e na matriz de perfis. O perfil de usuário comum simplesmente não a possui.

## O que o backend precisa garantir (o front apenas esconde e mostra)
- **Filtrar no servidor**: `GET /documentos`, `GET /documentos/:id`, downloads (principal e anexos), busca e contadores (`total` de `/categorias`) devem considerar a autorização do usuário. Documento confidencial sem autorização **não aparece na lista, na busca nem nos totais**, e o acesso direto retorna **403** (ou 404, se preferirem não revelar que existe). O front trata o 403 com a mensagem "Você não tem autorização para visualizar este conteúdo."
- Autorização por grupo vale para todos os membros atuais do grupo.
- Autorização com `validaAte` no passado deixa de valer (o front mostra "Expirada", mas quem decide é o servidor).
- Documento sem classificação informada deve ser tratado como definido pela instituição (sugestão: `geral`).
- Quem cadastra sem a permissão `documentos:permissoes` não envia `classificacao`; o servidor aplica o padrão.
- Todas as rotas abaixo exigem `documentos:permissoes` e geram registro de auditoria.

## Mudanças em contratos existentes
| Onde | Mudança |
|---|---|
| `Documento` (`/documentos`, `/documentos/:id`) | novo campo `classificacao`: `"geral"` ou `"confidencial"` |
| `POST /documentos` e `PATCH /documentos/:id` (multipart) | campo opcional `classificacao`, aceito só de quem tem `documentos:permissoes` |
| `GET /documentos` | novo filtro `classificacao` |
| Listagem administrativa de `GET /documentos` | para documentos confidenciais, objeto `autorizados: { usuarios: n, grupos: n }` (resumo exibido na coluna "Acesso"). Sem ele a coluna mostra "—" |
| Códigos de auditoria | `documento.classificacao`, `documento.acesso.concessao`, `documento.acesso.alteracao`, `documento.acesso.revogacao` |

## Endpoints novos (⏳ dependem do backend)
| Método e rota | Corpo / parâmetros | Resposta |
|---|---|---|
| `GET /admin/documentos/:id/acesso` | n/a | `{ classificacao, autorizacoes: [Autorizacao] }` |
| `PUT /admin/documentos/:id/classificacao` | `{ classificacao }` | 200 |
| `POST /admin/documentos/:id/autorizacoes` | `{ tipo: "usuario"\|"grupo", sujeitoId, validaAte: "YYYY-MM-DD"\|null }` | 201. Erro (409) se já existir |
| `PATCH /admin/documentos/:id/autorizacoes/:autId` | `{ validaAte: "YYYY-MM-DD"\|null }` | 200 |
| `DELETE /admin/documentos/:id/autorizacoes/:autId` | n/a | 204 |
| `GET /admin/grupos?busca=&limite=` | n/a | `{ itens: [{ id, nome, descricao, membros }], total, pagina, limite, totalPaginas }` |

A busca de usuários para autorizar reutiliza `GET /admin/usuarios?busca=&situacao=ativo&limite=8`. **Atenção:** quem tem `documentos:permissoes` mas não `usuarios:gerenciar` também precisa conseguir buscar usuários e grupos (apenas `id`, `nome` e `email`) para conceder acesso; o servidor deve permitir essa consulta mínima para essa permissão.
`Autorizacao`: `{ id, tipo ("usuario"|"grupo"), sujeitoId, nome, concedidoPor, concedidoEm (ISO 8601), validaAte (YYYY-MM-DD ou null) }`.

**Fora do escopo desta entrega:** cadastro e edição de grupos e de seus membros (o front só consome a lista de grupos).

## Onde fica no front
| Necessidade | Tela |
|---|---|
| Classificar ao cadastrar/editar | popup de documento (campo "Classificação", visível só com `documentos:permissoes`) |
| Ver classificação e permissões atuais | Administração > Documentos: colunas "Classificação" e "Acesso" |
| Conceder, alterar prazo, revogar, mudar classificação | Administração > Documentos > botão **Acesso** (também por "Gerenciar acesso" na página do documento) |
| Usuário comum | selo **Confidencial** e destaque na linha nas listas e no detalhe; nenhum controle administrativo |

## Estado da integração
| Funcionalidade | Situação |
|---|---|
| Campo e filtro de classificação (cadastro, edição, listas) | Pronto na interface; depende de o back aceitar/devolver `classificacao` |
| Selo e destaque para o usuário | Pronto |
| Tratamento de 403 no detalhe | Pronto |
| Gestão de acesso (classificar, conceder, alterar, revogar) | Interface pronta; **depende dos endpoints acima**. Sem eles, mostra "Funcionalidade em implantação" e nada é simulado |
