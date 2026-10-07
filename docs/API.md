# Contrato da API (o que o front espera)

Base: `API_BASE` em `frontend/assets/js/config.js`. JSON em UTF-8, exceto upload (`multipart/form-data`).
Autenticação por **cookie de sessão** (`HttpOnly`, `Secure`, `SameSite=Lax`); o front envia `credentials: 'include'`.
Libere CORS para a origem do front com `Access-Control-Allow-Credentials: true`.
Erros: status HTTP adequado + `{ "mensagem": "texto em português para o usuário" }`. **401** faz o front voltar ao login.

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/auth/login` | `{ email, senha }` | 200 e cookie de sessão |
| POST | `/auth/logout` | n/a | 204 |
| POST | `/auth/recuperar` | `{ email }` | **204 sempre**, exista o e-mail ou não |
| POST | `/auth/redefinir` | `{ token, senha }` | 204. Token de uso único e expiração curta |
| GET | `/me` | n/a | `{ nome, email, cpf, telefone, cargo, nivelAcesso, departamento, fotoUrl, permissoes }` (CPF já mascarado). `permissoes` é uma lista como `['documentos:cadastrar','documentos:editar','documentos:excluir']`; o front só usa para **esconder botões** |
| POST | `/me/foto` | multipart: `foto` (imagem, até 5 MB) | 200 `{ fotoUrl }` |
| PATCH | `/me` | `{ nome, telefone }` | 200. Ignorar qualquer outro campo |
| GET | `/categorias` | n/a | `[{ id, nome, descricao, total }]` (`total` = nº de documentos, usado nos chips). Ids usados pelo front: atas, comunicacao, convencoes, administrativos, eventos, oficios, parcerias, relatorios |
| GET | `/documentos?categoria=&busca=&pagina=&limite=` | n/a | `{ itens: [Documento], total, pagina, limite, totalPaginas }`. O front pede `limite=20`. `busca` deve procurar em **título, assunto, palavras-chave e nome da categoria** (idealmente, no futuro, também no conteúdo dos arquivos) |
| GET | `/documentos/:id` | n/a | `Documento` completo (abaixo) |
| PATCH | `/documentos/:id` | multipart, mesmos campos do cadastro; `arquivo` opcional (substitui o principal) | 200 |
| DELETE | `/documentos/:id` | n/a | 204 |
| POST | `/documentos` | multipart: `titulo`, `categoria`, `data` (`YYYY-MM-DD`), `palavrasChave` (separadas por vírgula), `assunto`, `descricao`, `arquivo` (**opcional**) | 201 |
| GET | `/documentos/:id/download` | `?inline=1` abre no navegador | arquivo principal, com checagem de permissão |
| GET | `/documentos/:id/arquivos/:arqId/download` | n/a | arquivo anexo |
| POST | `/me/senha` | `{ senhaAtual, novaSenha }` | 204; 400/403 se a senha atual estiver errada |

`Documento`: `{ id, titulo, categoria (id), data, assunto, descricao, palavrasChave: [texto], criadoPor, tipo (extensão do arquivo principal), tamanhoBytes, arquivos: [{ id, nome, tipo, tamanhoBytes, criadoEm }] }`. Datas em `YYYY-MM-DD`. Sem arquivo, `arquivos` vem vazio. **`arquivos[0]` é o arquivo principal** (o do botão Baixar/Abrir); os demais são anexos. Hoje o front só cadastra o principal; anexos são exibidos se o back os fornecer.

## Regras que o back deve garantir (o front não protege nada)
- Revalidar a senha (mín. 8, 1 número, 1 especial), tipos de arquivo (pdf, doc, docx, xls, xlsx, txt, png, jpg, zip) e tamanho (hoje 100 MB; o protótipo cita 5 GB, definir o limite real) no servidor; checar o conteúdo real do arquivo e passar antivírus.
- Autorização por perfil em cada rota; `nivelAcesso`, `cargo` e `departamento` nunca vêm do front.
- Link de redefinição: `https://<front>/senhanova.html?token=<token>`.
- CPF e documentos são dados pessoais (LGPD): log de acesso, criptografia em repouso, não servir arquivos de pasta pública.

## Permissões
Cada rota acima precisa checar a permissão no servidor (o front só esconde botões). Definir com o SINDESEI os perfis (ex.: administrador, gestor, editor, visualizador) e o que cada um pode.

## Pendências para o back (levantadas na avaliação)
- Armazenamento privado dos arquivos (nome interno aleatório, download só via API com autorização) e validação de tipo real/antivírus.
- Auditoria: registrar quem visualizou/baixou/alterou cada documento e quando.
- LGPD: base legal, retenção, criptografia em repouso, mascaramento de CPF.
- Limite de upload: o front usa 100 MB (`MAX_MB`); o protótipo cita 5 GB. Para arquivos muito grandes, avaliar upload em partes.
- Recuperação de senha: e-mail, token de uso único, expiração, limite de tentativas.
- Escalabilidade da busca (índice de texto) e das listagens.
