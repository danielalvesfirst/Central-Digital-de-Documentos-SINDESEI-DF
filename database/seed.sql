-- Dados fictícios para desenvolvimento. Não contém usuários nem senhas de login.
BEGIN;
SET search_path TO app_sindesei, public;

INSERT INTO departamentos (nome) VALUES
 ('Administrativo'), ('Comunicação'), ('Jurídico'), ('Gestão Documental')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO perfis_acesso (codigo, nome, descricao) VALUES
 ('administrador', 'Administrador', 'Acesso administrativo; permissões finais devem ser aprovadas pelo sindicato.'),
 ('editor', 'Editor', 'Pode cadastrar e editar documentos conforme autorização da API.'),
 ('visualizador', 'Visualizador', 'Consulta documentos e categorias.')
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao;

INSERT INTO permissoes (codigo, descricao) VALUES
 ('documentos:cadastrar', 'Cadastrar documentos'),
 ('documentos:editar', 'Editar documentos'),
 ('documentos:excluir', 'Excluir documentos'),
 ('documentos:consultar', 'Consultar documentos'),
 ('categorias:consultar', 'Consultar categorias'),
 ('usuarios:gerenciar', 'Gerenciar usuários e perfis')
ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao;

-- Matriz inicial de permissões demonstrativa. Confirmar a matriz real com o SINDESEI.
INSERT INTO perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, pe.id
FROM perfis_acesso p
JOIN permissoes pe ON (
    p.codigo = 'administrador'
 OR (p.codigo = 'editor' AND pe.codigo IN ('documentos:cadastrar','documentos:editar','documentos:consultar','categorias:consultar'))
 OR (p.codigo = 'visualizador' AND pe.codigo IN ('documentos:consultar','categorias:consultar'))
)
ON CONFLICT DO NOTHING;

INSERT INTO categorias (id, nome, descricao) VALUES
 ('atas', 'Atas', 'Registro de reuniões e decisões.'),
 ('comunicacao', 'Comunicação', 'Materiais e comunicados institucionais.'),
 ('convencoes', 'Convenções coletivas', 'Acordos e normas trabalhistas.'),
 ('administrativos', 'Documentos administrativos', 'Gestão interna e documentos do sindicato.'),
 ('eventos', 'Eventos', 'Informações sobre eventos e atividades.'),
 ('oficios', 'Ofícios', 'Comunicações oficiais e formais.'),
 ('parcerias', 'Parcerias e convênios', 'Acordos com instituições parceiras.'),
 ('relatorios', 'Relatórios', 'Dados, análises e resultados.')
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, atualizado_em = CURRENT_TIMESTAMP;

INSERT INTO documentos (titulo, categoria_id, data_documento, assunto, descricao)
SELECT v.titulo, v.categoria_id, v.data_documento, v.assunto, v.descricao
FROM (VALUES
 ('Ata de reunião administrativa - exemplo', 'atas', DATE '2026-09-15', 'Reunião administrativa', 'Registro fictício para validar a listagem e o detalhe de documentos.'),
 ('Comunicado institucional de exemplo', 'comunicacao', DATE '2026-09-20', 'Comunicado aos associados', 'Conteúdo demonstrativo; substituir por documento autorizado antes de produção.'),
 ('Convenção coletiva - referência de teste', 'convencoes', DATE '2026-08-01', 'Normas trabalhistas', 'Registro fictício para testar filtro por categoria.'),
 ('Checklist administrativo - exemplo', 'administrativos', DATE '2026-10-01', 'Rotina administrativa', 'Exemplo de documento sem arquivo anexado.'),
 ('Calendário de eventos - exemplo', 'eventos', DATE '2026-10-10', 'Agenda institucional', 'Dados de teste para a página inicial.'),
 ('Relatório mensal demonstrativo', 'relatorios', DATE '2026-10-15', 'Indicadores mensais', 'Relatório fictício sem dados pessoais.')
) AS v(titulo, categoria_id, data_documento, assunto, descricao)
WHERE NOT EXISTS (SELECT 1 FROM documentos d WHERE d.titulo = v.titulo);

-- Insere palavras-chave relacionando-as aos documentos pelo título, sem depender dos IDs gerados.
INSERT INTO palavras_chave (termo, termo_normalizado)
VALUES
 ('reunião', 'reuniao'),
 ('administrativo', 'administrativo'),
 ('comunicado', 'comunicado'),
 ('associados', 'associados'),
 ('normas trabalhistas', 'normas trabalhistas'),
 ('rotina', 'rotina'),
 ('eventos', 'eventos'),
 ('indicadores', 'indicadores'),
 ('mensal', 'mensal')
ON CONFLICT (termo_normalizado) DO UPDATE SET termo = EXCLUDED.termo;

INSERT INTO documento_palavras_chave (documento_id, palavra_chave_id)
SELECT d.id, p.id
FROM (VALUES
 ('Ata de reunião administrativa - exemplo', 'reuniao'),
 ('Ata de reunião administrativa - exemplo', 'administrativo'),
 ('Comunicado institucional de exemplo', 'comunicado'),
 ('Comunicado institucional de exemplo', 'associados'),
 ('Convenção coletiva - referência de teste', 'normas trabalhistas'),
 ('Checklist administrativo - exemplo', 'rotina'),
 ('Calendário de eventos - exemplo', 'eventos'),
 ('Relatório mensal demonstrativo', 'indicadores'),
 ('Relatório mensal demonstrativo', 'mensal')
) AS x(titulo, termo_normalizado)
JOIN documentos d ON d.titulo = x.titulo
JOIN palavras_chave p ON p.termo_normalizado = x.termo_normalizado
ON CONFLICT DO NOTHING;

COMMIT;
