-- Consultas de referência para o backend. Execute no banco do projeto.
SET search_path TO app_sindesei, public;

-- 1. Categorias ativas e contagem de documentos (GET /categorias).
SELECT c.id, c.nome, c.descricao, COUNT(d.id)::INTEGER AS total
FROM categorias c
LEFT JOIN documentos d ON d.categoria_id = c.id
WHERE c.ativa
GROUP BY c.id, c.nome, c.descricao
ORDER BY c.nome;

-- 2. Lista paginada, filtro opcional por categoria e termo de busca.
-- Valores de demonstração abaixo; no backend, substituir por parâmetros preparados.
SELECT d.id, d.titulo, d.categoria_id AS categoria, d.data_documento AS data,
       d.assunto, d.descricao, u.nome AS criado_por,
       principal.extensao AS tipo, principal.tamanho_bytes AS tamanho_bytes
FROM documentos d
JOIN categorias c ON c.id = d.categoria_id AND c.ativa
LEFT JOIN usuarios u ON u.id = d.criado_por
LEFT JOIN arquivos_documento principal
       ON principal.documento_id = d.id AND principal.principal
WHERE d.categoria_id = 'atas'
  AND (
    d.titulo ILIKE '%reunião%'
    OR d.assunto ILIKE '%reunião%'
    OR c.nome ILIKE '%reunião%'
    OR EXISTS (
       SELECT 1
       FROM documento_palavras_chave dpk
       JOIN palavras_chave pk ON pk.id = dpk.palavra_chave_id
       WHERE dpk.documento_id = d.id AND pk.termo ILIKE '%reunião%'
    )
  )
ORDER BY d.data_documento DESC, d.id DESC
LIMIT 20 OFFSET 0;

-- 3. Detalhe do documento, metadados do arquivo principal e do criador.
SELECT d.*, c.nome AS categoria_nome, u.nome AS criado_por_nome
FROM documentos d
JOIN categorias c ON c.id = d.categoria_id
LEFT JOIN usuarios u ON u.id = d.criado_por
WHERE d.id = (SELECT MIN(id) FROM documentos);

-- 4. Palavras-chave de um documento.
SELECT pk.id, pk.termo
FROM documento_palavras_chave dpk
JOIN palavras_chave pk ON pk.id = dpk.palavra_chave_id
WHERE dpk.documento_id = (SELECT MIN(id) FROM documentos)
ORDER BY pk.termo;

-- 5. Arquivos de um documento (arquivos[0] do contrato deve ser o principal).
SELECT id, nome_original AS nome, extensao AS tipo, tamanho_bytes,
       criado_em AS criado_em, principal, storage_key, mime_type, sha256
FROM arquivos_documento
WHERE documento_id = (SELECT MIN(id) FROM documentos)
ORDER BY principal DESC, criado_em, id;

-- 6. Dados do perfil do usuário autenticado; nunca retornar senha_hash/token_hash.
SELECT u.id, u.nome, u.email, u.cpf, u.telefone, u.cargo,
       d.nome AS departamento, p.nome AS nivel_acesso, u.foto_storage_key
FROM usuarios u
LEFT JOIN departamentos d ON d.id = u.departamento_id
JOIN perfis_acesso p ON p.id = u.perfil_id
WHERE u.id = 1 AND u.ativo;

-- 7. Permissões efetivas do usuário para compor o campo permissoes do GET /me.
SELECT pe.codigo
FROM usuarios u
JOIN perfil_permissoes pp ON pp.perfil_id = u.perfil_id
JOIN permissoes pe ON pe.id = pp.permissao_id
WHERE u.id = 1 AND u.ativo
ORDER BY pe.codigo;

-- 8. Login: buscar usuário pelo e-mail normalizado; comparar senha no backend
-- usando uma biblioteca de hashing (Argon2id/bcrypt). Nunca comparar texto puro.
SELECT id, senha_hash, ativo, perfil_id
FROM usuarios
WHERE lower(email) = lower('usuario@exemplo.invalid');

-- 9. Criar token de redefinição: salvar somente hash criptográfico do token aleatório.
-- INSERT INTO tokens_redefinicao_senha (usuario_id, token_hash, expira_em)
-- VALUES (:usuario_id, :sha256_token_hex, CURRENT_TIMESTAMP + INTERVAL '30 minutes');

-- 10. Validar token ainda não utilizado e não expirado.
SELECT id, usuario_id
FROM tokens_redefinicao_senha
WHERE token_hash = :sha256_token_hex
  AND usado_em IS NULL
  AND expira_em > CURRENT_TIMESTAMP;

-- 11. Registrar consumo do token dentro da mesma transação que atualiza a senha.
-- UPDATE tokens_redefinicao_senha SET usado_em = CURRENT_TIMESTAMP
-- WHERE id = :token_id AND usado_em IS NULL AND expira_em > CURRENT_TIMESTAMP;

-- 12. Inserir documento e associar palavras-chave:
-- faça INSERT em documentos ... RETURNING id; depois faça UPSERT em palavras_chave
-- e INSERT em documento_palavras_chave. Execute tudo em uma transação.

-- 13. Remover documento (a FK apaga palavras-chave associadas e arquivos-metadados).
-- DELETE FROM documentos WHERE id = :documento_id;
-- A exclusão do registro NÃO apaga o objeto físico do storage: o backend deve remover
-- o arquivo privado com tratamento de falhas/retentativas.

-- 14. Registrar evento de auditoria.
-- INSERT INTO auditoria (usuario_id, documento_id, acao, entidade, entidade_id, detalhes, ip, user_agent)
-- VALUES (:usuario_id, :documento_id, :acao, 'documento', :entidade_id,
--         :detalhes_jsonb, :ip, :user_agent);

-- 15. Painel inicial: contagem de documentos, categorias e categorias com documentos.
SELECT COUNT(*)::INTEGER AS documentos_cadastrados FROM documentos;
SELECT COUNT(*)::INTEGER AS categorias_ativas FROM categorias WHERE ativa;
SELECT COUNT(DISTINCT categoria_id)::INTEGER AS categorias_com_documentos
FROM documentos d JOIN categorias c ON c.id = d.categoria_id
WHERE c.ativa;

-- 16. Documentos mais recentes.
SELECT id, titulo, categoria_id AS categoria, data_documento AS data, assunto
FROM documentos
ORDER BY criado_em DESC, id DESC
LIMIT 5;
