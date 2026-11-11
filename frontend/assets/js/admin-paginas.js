// Telas da área administrativa. Cada tela só usa endpoints de Api (ver docs/API-ADMIN.md).
const PAGINAS = {
  painel: ["Painel administrativo", null], usuarios: ["Usuários", "usuarios:gerenciar"], perfis: ["Perfis e permissões", "usuarios:gerenciar"],
  documentos: ["Documentos", "documentos:visualizar"], categorias: ["Categorias", "configuracoes:administrar"],
  auditoria: ["Auditoria e atividades", "auditoria:consultar"], configuracoes: ["Configurações", "configuracoes:administrar"],
};
const cpfValido = (v) => {
  const n = String(v).replace(/\D/g, "");
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  const dig = (k) => { let s = 0; for (let i = 0; i < k; i++) s += +n[i] * (k + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dig(9) === +n[9] && dig(10) === +n[10];
};
const bloco = (main, titulo) => { const c = el("div"); main.append(el("section", { className: "bloco" }, el("h3", { textContent: titulo }), c)); return c; };
const stat = (v, r) => el("div", { className: "stat" }, el("strong", { textContent: String(v ?? "—") }), el("span", { textContent: r }));
// Carrega dados auxiliares (ex.: perfis para filtros). Retorna null em caso de falha, para não confundir com "lista vazia".
// Endpoint ainda indisponível é silencioso (a própria tela já avisa); falha real avisa o usuário.
const carregarOpcoes = async (fn, rotulo) => {
  try { return await fn(); } catch (e) {
    if (!e.pendente) Adm.toast(`Não foi possível carregar ${rotulo}. ${e.negado ? "Você não tem permissão." : e.message}`, "erro");
    return null;
  }
};

const telas = {
  async painel(pode, main) {
    const resumo = () => Api.admin.resumo();
    const vedocs = pode("documentos:visualizar");
    const docs = () => Promise.all([Api.categorias(), Api.documentos({ pagina: 1, limite: 5 })]);
    if (vedocs) Adm.carregar(bloco(main, "Documentos"), docs, ([cats, r], d) => {
      const nomeCat = (id) => (cats.find((c) => c.id === id) || {}).nome || id;
      d.append(el("div", { className: "stats" }, stat(cats.reduce((s, c) => s + c.total, 0), "documentos cadastrados"), stat(cats.length, "categorias")),
        el("h3", { textContent: "Adicionados recentemente", style: "margin:8px 0 12px;font-size:17px" }),
        r.itens.length ? Adm.tabela("Documentos recentes", [
          { t: "Título", f: (x) => el("a", { href: "documento.html?id=" + x.id, textContent: x.titulo }) },
          { t: "Categoria", f: (x) => nomeCat(x.categoria) }, { t: "Responsável", f: (x) => x.criadoPor }, { t: "Data", f: (x) => dataBR(x.data) }], r.itens)
          : Adm.estado("vazio", "Nenhum documento cadastrado", "Os documentos cadastrados aparecerão aqui."));
    });
    if (vedocs) Adm.carregar(bloco(main, "Documentos por categoria"), docs, ([cats], d) => {
      const max = Math.max(1, ...cats.map((c) => c.total));
      d.append(el("div", { className: "dist" }, ...cats.map((c) => el("div", { className: "linha" }, el("span", { textContent: c.nome }),
        el("div", { className: "trilho", "aria-hidden": "true" }, el("div", { className: "preench", style: `width:${(c.total / max) * 100}%` })), el("span", { className: "n", textContent: String(c.total) })))));
    });
    Adm.carregar(bloco(main, "Usuários e atividades administrativas"), resumo, (r, d) => {
      const u = r.usuarios || {};
      d.append(el("div", { className: "stats" }, stat(u.total, "usuários cadastrados"), stat(u.ativos, "ativos"), stat(u.bloqueados, "bloqueados")),
        el("h3", { textContent: "Atividades recentes", style: "margin:8px 0 12px;font-size:17px" }),
        (r.atividadesRecentes || []).length ? Adm.tabela("Atividades recentes", [
          { t: "Data/hora", f: (a) => dataHora(a.quando) }, { t: "Usuário", f: (a) => a.usuario },
          { t: "Ação", f: (a) => ACOES_AUDITORIA[a.acao] || a.acao }, { t: "Recurso", f: (a) => recursoTxt(a.recurso) }], r.atividadesRecentes)
          : Adm.estado("vazio", "Nenhuma atividade registrada", "As atividades administrativas aparecerão aqui."));
      if (pode("auditoria:consultar")) d.append(el("p", { style: "margin-top:14px" }, el("a", { href: "admin-auditoria.html", textContent: "Ver toda a auditoria" })));
    });
  },

  async usuarios(pode, main) {
    const perfis = await carregarOpcoes(() => Api.admin.perfis(), "os perfis");
    const optPerfil = (perfis || []).map((p) => ({ valor: p.id, rotulo: p.nome }));
    const semPerfil = perfis === null ? "Não foi possível carregar os perfis" : "Nenhum perfil disponível";
    const novo = el("button", { type: "button", className: "btn btn-ouro", textContent: "+ Novo usuário", style: "margin-bottom:16px" });
    const alvo = el("div"); main.append(novo, alvo);
    const campos = (edicao) => [
      { id: "nome", rotulo: "Nome completo", obrigatorio: true }, { id: "email", rotulo: "E-mail corporativo", tipo: "email", obrigatorio: true, desabilitado: edicao },
      ...(edicao ? [] : [{ id: "cpf", rotulo: "CPF", obrigatorio: true }]),
      { id: "telefone", rotulo: "Telefone" }, { id: "cargo", rotulo: "Cargo" }, { id: "departamento", rotulo: "Departamento" },
      { id: "perfilId", rotulo: "Perfil de acesso", tipo: "select", obrigatorio: true, opcoes: optPerfil.length ? optPerfil : [{ valor: "", rotulo: semPerfil }], desabilitado: !optPerfil.length },
    ];
    const lista = Adm.listagem({
      destino: alvo, legenda: "Usuários", vazio: "Nenhum usuário encontrado com esses filtros.", buscar: Api.admin.usuarios,
      campos: [{ id: "busca", rotulo: "Nome ou e-mail", dica: "Buscar..." }, { id: "perfil", rotulo: "Perfil", tipo: "select", opcoes: optPerfil },
        { id: "departamento", rotulo: "Departamento" }, { id: "situacao", rotulo: "Situação", tipo: "select", opcoes: [{ valor: "ativo", rotulo: "Ativo" }, { valor: "bloqueado", rotulo: "Bloqueado" }] }],
      colunas: [
        { t: "Nome", f: (u) => el("strong", { textContent: u.nome }) }, { t: "E-mail", f: (u) => u.email }, { t: "Departamento", f: (u) => u.departamento },
        { t: "Perfil", f: (u) => u.perfil }, { t: "Situação", f: (u) => Adm.badge(u.situacao === "bloqueado" ? "Bloqueado" : "Ativo", u.situacao === "bloqueado" ? "bloq" : "ok") },
        { t: "Ações", f: (u) => acoesUsuario(u) }],
    });
    const btn = (txt, nome, fn, cls = "btn-vazado") => { const b = el("button", { type: "button", className: "btn btn-sm " + cls, textContent: txt }); b.setAttribute("aria-label", `${txt} ${nome}`); b.onclick = fn; return b; };
    function acoesUsuario(u) {
      const bloq = u.situacao === "bloqueado";
      return el("div", { className: "acoes-linha" },
        btn("Ver", u.nome, () => detalhe(u)), btn("Editar", u.nome, () => editar(u)),
        btn(bloq ? "Reativar" : "Bloquear", u.nome, () => alternar(u, bloq), bloq ? "" : "btn-perigo"));
    }
    function detalhe(u) {
      const corpo = el("div"); const fechar = el("button", { type: "button", className: "btn", textContent: "Fechar" });
      const d = Adm.modal("Detalhes do usuário", corpo, [fechar]); fechar.onclick = () => d.close();
      Adm.carregar(corpo, () => Api.admin.usuario(u.id), (x, c) => c.append(el("dl", { className: "detalhe" }, ...[
        ["Nome", x.nome], ["E-mail", x.email], ["CPF", x.cpf], ["Telefone", x.telefone], ["Cargo", x.cargo], ["Departamento", x.departamento],
        ["Perfil", x.perfil], ["Situação", x.situacao === "bloqueado" ? "Bloqueado" : "Ativo"], ["Último acesso", dataHora(x.ultimoAcesso)], ["Cadastrado em", dataHora(x.criadoEm)],
      ].flatMap(([k, v]) => [el("dt", { textContent: k }), el("dd", { textContent: v || "—" })]))));
    }
    novo.onclick = () => Adm.formulario({ titulo: "Novo usuário", campos: campos(false), botao: "Cadastrar usuário",
      info: "O usuário receberá por e-mail um link para definir a própria senha.",
      enviar: async (d) => {
        if (!d.perfilId) throw new Error("Não foi possível carregar os perfis. Tente novamente em instantes.");
        if (!cpfValido(d.cpf)) throw new Error("Informe um CPF válido.");
        await Api.admin.criarUsuario(d); Adm.toast("Usuário cadastrado."); lista.recarregar(); } });
    function editar(u) {
      Adm.formulario({ titulo: "Editar usuário", campos: campos(true), valores: { ...u, perfilId: u.perfilId }, botao: "Salvar alterações",
        enviar: async (d) => {
          if (d.perfilId && d.perfilId !== u.perfilId && !(await Adm.confirmar({ titulo: "Alterar perfil", texto: `Mudar o perfil de ${u.nome} altera as permissões dessa conta. Deseja continuar?` }))) return false; // cancelou: mantém o formulário aberto, sem mensagem de erro
          await Api.admin.editarUsuario(u.id, { nome: d.nome, telefone: d.telefone, cargo: d.cargo, departamento: d.departamento, perfilId: d.perfilId });
          Adm.toast("Usuário atualizado."); lista.recarregar(); } });
    }
    async function alternar(u, bloq) {
      const ok = await Adm.confirmar({ titulo: bloq ? "Reativar conta" : "Bloquear conta", perigo: !bloq, botao: bloq ? "Reativar" : "Bloquear",
        texto: bloq ? `${u.nome} voltará a acessar a Central.` : `${u.nome} não conseguirá mais acessar a Central até ser reativado.` });
      if (!ok) return;
      try { await (bloq ? Api.admin.reativarUsuario(u.id) : Api.admin.bloquearUsuario(u.id)); Adm.toast(bloq ? "Conta reativada." : "Conta bloqueada."); lista.recarregar(); } catch (e) { Adm.falha(e); }
    }
  },

  async perfis(pode, main) {
    main.append(el("p", { className: "sub", textContent: "A matriz mostra o que cada perfil pode fazer. O servidor valida as permissões em cada operação." }));
    const alvo = el("div"); main.append(alvo);
    const desenhar = () => Adm.carregar(alvo, () => Api.admin.perfis(), (perfis, d) => {
      if (!perfis.length) return d.append(Adm.estado("vazio", "Nenhum perfil cadastrado", "Nenhum perfil disponível."));
      const codigos = Object.keys(PERMISSOES);
      perfis.forEach((p) => (p.permissoes || []).forEach((c) => { if (!codigos.includes(c)) codigos.push(c); }));
      const rot = (c) => PERMISSOES[c] || c;
      const cab = el("tr", {}, el("th", { scope: "col", textContent: "Permissão" }), ...perfis.map((p) => {
        const b = el("button", { type: "button", className: "btn btn-sm", textContent: "Editar" }); b.setAttribute("aria-label", "Editar permissões do perfil " + p.nome); b.onclick = () => editar(p);
        return el("th", { scope: "col" }, p.nome, el("small", { textContent: `${p.usuarios ?? 0} usuário(s)` }), b); }));
      const linhas = codigos.map((c) => el("tr", {}, el("th", { scope: "row", textContent: rot(c) }), ...perfis.map((p) => {
        const sim = (p.permissoes || []).includes(c);
        return el("td", {}, el("span", { className: sim ? "sim" : "nao", "aria-hidden": "true", textContent: sim ? "✓" : "—" }), el("span", { className: "sr-only", textContent: sim ? "Permitido" : "Não permitido" })); })));
      d.append(el("div", { className: "rolagem" }, el("table", { className: "tab matriz" }, el("caption", { className: "sr-only", textContent: "Matriz de permissões por perfil" }), el("thead", {}, cab), el("tbody", {}, ...linhas))),
        el("div", { className: "perfis-desc" }, ...perfis.filter((p) => p.descricao).map((p) => el("p", {}, el("strong", { textContent: p.nome + ": " }), p.descricao))));
      function editar(p) {
        const grupo = el("fieldset", {}, el("legend", { textContent: "Permissões do perfil " + p.nome }), el("div", { className: "checks" },
          ...codigos.map((c) => el("label", {}, el("input", { type: "checkbox", value: c, checked: (p.permissoes || []).includes(c) }), rot(c)))));
        const cancelar = el("button", { type: "button", className: "btn btn-vazado", textContent: "Cancelar" }), salvar = el("button", { type: "button", className: "btn", textContent: "Salvar permissões" });
        const m = Adm.modal("Editar permissões", grupo, [cancelar, salvar]); cancelar.onclick = () => m.close();
        salvar.onclick = async () => {
          const sel = [...m.querySelectorAll("input:checked")].map((i) => i.value);
          if (!(await Adm.confirmar({ titulo: "Confirmar alteração", texto: `Alterar as permissões do perfil "${p.nome}" afeta ${p.usuarios ?? 0} usuário(s). Deseja continuar?` }))) return;
          try { await Api.admin.salvarPermissoes(p.id, sel); m.close(); Adm.toast("Permissões atualizadas."); desenhar(); } catch (e) { Adm.falha(e); }
        };
      }
    });
    desenhar();
  },

  async documentos(pode, main) {
    const cats = (await carregarOpcoes(() => Api.categorias(), "as categorias")) || [];
    const nomeCat = (id) => (cats.find((c) => c.id === id) || {}).nome || id;
    const alvo = el("div");
    if (pode("documentos:cadastrar")) { const n = el("button", { type: "button", className: "btn btn-ouro", textContent: "+ Cadastrar documento", style: "margin-bottom:16px" }); n.onclick = () => Cadastro.abrir(() => { Adm.toast("Documento cadastrado."); lista.recarregar(); }, null, { classificar: pode("documentos:permissoes") }); main.append(n); }
    main.append(alvo);
    const btn = (txt, nome, fn, cls = "btn-vazado") => { const b = el("button", { type: "button", className: "btn btn-sm " + cls, textContent: txt }); b.setAttribute("aria-label", `${txt}: ${nome}`); b.onclick = fn; return b; };
    const hoje = () => new Date().toISOString().slice(0, 10);
    const seloOuGeral = (d) => (d.classificacao === "confidencial" ? seloClassificacao(d) : Adm.badge("Geral"));
    const resumoAcesso = (d) => {
      if (d.classificacao !== "confidencial") return "Todos os usuários";
      if (!d.autorizados) return "—";
      const { usuarios = 0, grupos = 0 } = d.autorizados;
      return usuarios + grupos === 0 ? Adm.badge("Ninguém autorizado", "bloq") : `${usuarios} usuário(s), ${grupos} grupo(s)`;
    };
    const lista = Adm.listagem({
      destino: alvo, legenda: "Documentos", vazio: "Nenhum documento encontrado. Ajuste os filtros ou cadastre um novo documento.", buscar: Api.documentos,
      campos: [{ id: "busca", rotulo: "Título", dica: "Buscar por título" }, { id: "categoria", rotulo: "Categoria", tipo: "select", opcoes: cats.map((c) => ({ valor: c.id, rotulo: c.nome })) },
        { id: "classificacao", rotulo: "Classificação", tipo: "select", opcoes: [{ valor: "geral", rotulo: "Acesso geral" }, { valor: "confidencial", rotulo: "Confidencial" }] },
        { id: "responsavel", rotulo: "Responsável", dica: "Nome de quem cadastrou" }, { id: "de", rotulo: "Cadastrado de", tipo: "date" }, { id: "ate", rotulo: "até", tipo: "date" }],
      colunas: [
        { t: "Título", f: (d) => el("a", { href: "documento.html?id=" + d.id, textContent: d.titulo }) }, { t: "Categoria", f: (d) => nomeCat(d.categoria) }, { t: "Classificação", f: (d) => seloOuGeral(d) }, { t: "Acesso", f: (d) => resumoAcesso(d) },
        { t: "Responsável", f: (d) => d.criadoPor }, { t: "Data", f: (d) => dataBR(d.data) },
        { t: "Ações", f: (d) => el("div", { className: "acoes-linha" },
          el("a", { className: "btn btn-sm btn-vazado", href: "documento.html?id=" + d.id, textContent: "Ver" }),
          pode("documentos:editar") ? btn("Editar", d.titulo, async () => { try { Cadastro.abrir(() => { Adm.toast("Documento atualizado."); lista.recarregar(); }, await Api.documento(d.id), { classificar: pode("documentos:permissoes") }); } catch (e) { Adm.falha(e); } }) : "",
          pode("documentos:permissoes") ? btn("Acesso", d.titulo, () => abrirAcesso(d)) : "",
          pode("auditoria:consultar") ? btn("Histórico", d.titulo, () => historico(d)) : "",
          pode("documentos:excluir") ? btn("Excluir", d.titulo, () => excluir(d), "btn-perigo") : "") }],
    });
    // Gestão de acesso: classificação + usuários/grupos autorizados (conceder, alterar prazo, revogar)
    function abrirAcesso(doc) {
      const corpo = el("div", { className: "acesso" }), fechar = el("button", { type: "button", className: "btn", textContent: "Fechar" });
      const m = Adm.modal("Acesso: " + doc.titulo, corpo, [fechar]);
      fechar.onclick = () => m.close(); m.addEventListener("close", () => lista.recarregar());
      const recarregar = () => Adm.carregar(corpo, () => Api.admin.acessoDocumento(doc.id), desenhar);
      function desenhar(a, d) {
        const conf = a.classificacao === "confidencial", auts = a.autorizacoes || [];
        const opc = (valor, titulo, texto) => el("label", {}, el("input", { type: "radio", name: "classificacao", value: valor, checked: a.classificacao === valor }),
          el("span", {}, el("strong", { textContent: titulo }), el("small", { className: "ajuda", textContent: texto })));
        const radios = el("fieldset", {}, el("legend", { textContent: "Classificação do documento" }), el("div", { className: "opcoes" },
          opc("geral", "Acesso geral", "Todos os usuários autenticados podem visualizar."), opc("confidencial", "Confidencial", "Somente pessoas e grupos autorizados podem visualizar.")));
        const salvarClass = el("button", { type: "button", className: "btn btn-sm", textContent: "Salvar classificação", disabled: true });
        radios.onchange = () => { salvarClass.disabled = radios.querySelector("input:checked").value === a.classificacao; };
        salvarClass.onclick = async () => {
          const nova = radios.querySelector("input:checked").value, paraGeral = nova === "geral";
          if (!(await Adm.confirmar({ titulo: paraGeral ? "Tornar documento de acesso geral" : "Tornar documento confidencial", perigo: paraGeral, botao: paraGeral ? "Tornar geral" : "Tornar confidencial",
            texto: paraGeral ? "Todos os usuários poderão visualizar este documento. As autorizações concedidas deixam de ser necessárias." : "Somente as pessoas e os grupos autorizados poderão visualizar este documento." }))) return;
          try { await Api.admin.classificarDocumento(doc.id, nova); doc.classificacao = nova; Adm.toast("Classificação atualizada."); recarregar(); } catch (e) { Adm.falha(e); }
        };
        d.append(el("div", {}, radios, el("div", { style: "margin-top:10px" }, salvarClass)));
        if (!conf) return d.append(el("p", { className: "sub", style: "margin-top:16px", textContent: "Este documento é de acesso geral. Para restringir a visualização, altere a classificação para Confidencial." }));

        d.append(el("h3", { textContent: "Quem pode visualizar" }));
        const prazo = (x) => { const v = (x.validaAte || "").slice(0, 10); return !v ? "Sem prazo" : v < hoje() ? Adm.badge("Expirada em " + dataBR(v), "bloq") : dataBR(v); };
        d.append(auts.length ? Adm.tabela("Autorizações do documento", [
          { t: "Tipo", f: (x) => Adm.badge(x.tipo === "grupo" ? "Grupo" : "Usuário") }, { t: "Nome", f: (x) => el("strong", { textContent: x.nome }) },
          { t: "Concedida por", f: (x) => x.concedidoPor }, { t: "Em", f: (x) => dataHora(x.concedidoEm) }, { t: "Válida até", f: prazo },
          { t: "Ações", f: (x) => el("div", { className: "acoes-linha" }, btn("Alterar prazo", x.nome, () => alterar(x)), btn("Revogar", x.nome, () => revogar(x), "btn-perigo")) }], auts)
          : Adm.estado("vazio", "Nenhuma autorização concedida", "Nenhum usuário ou grupo foi autorizado a visualizar este documento. Use o formulário abaixo para conceder acesso."));

        const rot = (id, txt) => el("label", { className: "rot", htmlFor: id, textContent: txt });
        const tipo = el("select", { id: "ac-tipo" }, el("option", { value: "usuario", textContent: "Usuário" }), el("option", { value: "grupo", textContent: "Grupo" }));
        const busca = el("input", { id: "ac-busca", type: "search", placeholder: "Digite o nome para buscar" }), valida = el("input", { id: "ac-valida", type: "date" });
        const resultados = el("div", { className: "resultados", "aria-live": "polite" });
        const conceder = el("button", { type: "button", className: "btn", textContent: "Conceder acesso", disabled: true });
        let timer, seq = 0;
        const buscar = async () => {
          const minha = ++seq, usuario = tipo.value === "usuario"; conceder.disabled = true;
          resultados.replaceChildren(el("p", { className: "contador", textContent: "Buscando..." }));
          try {
            const r = usuario ? await Api.admin.usuarios({ busca: busca.value.trim(), situacao: "ativo", limite: 8 }) : await Api.admin.grupos({ busca: busca.value.trim(), limite: 8 });
            if (minha !== seq) return;
            const ja = new Set(auts.map((x) => x.tipo + ":" + x.sujeitoId)), itens = r.itens.filter((i) => !ja.has(tipo.value + ":" + i.id));
            resultados.replaceChildren(itens.length ? el("fieldset", {}, el("legend", { className: "sr-only", textContent: "Resultados da busca" }),
              ...itens.map((i) => el("label", {}, el("input", { type: "radio", name: "alvo", value: i.id }), usuario ? `${i.nome} (${i.email})` : `${i.nome} (${i.membros ?? 0} membro(s))`)))
              : el("p", { className: "contador", textContent: "Nenhum resultado disponível para autorizar." }));
          } catch (e) { if (minha === seq) resultados.replaceChildren(Adm.erro(e, buscar)); }
        };
        resultados.onchange = () => { conceder.disabled = !resultados.querySelector("input:checked"); };
        busca.oninput = () => { clearTimeout(timer); timer = setTimeout(buscar, 300); }; tipo.onchange = buscar;
        conceder.onclick = async () => {
          const alvo = resultados.querySelector("input:checked"); if (!alvo) return; conceder.disabled = true;
          try { await Api.admin.conceder(doc.id, { tipo: tipo.value, sujeitoId: alvo.value, validaAte: valida.value || null }); Adm.toast("Acesso concedido."); recarregar(); }
          catch (e) { Adm.falha(e); conceder.disabled = false; }
        };
        d.append(el("h3", { textContent: "Conceder acesso" }), el("div", { className: "conceder" },
          el("div", {}, rot("ac-tipo", "Conceder a"), tipo), el("div", {}, rot("ac-busca", "Buscar"), busca), resultados,
          el("div", {}, rot("ac-valida", "Válida até (opcional)"), valida), el("div", {}, conceder)));
        buscar();

        function alterar(x) {
          Adm.formulario({ titulo: "Alterar autorização", info: x.nome, botao: "Salvar", valores: { validaAte: (x.validaAte || "").slice(0, 10) },
            campos: [{ id: "validaAte", rotulo: "Válida até", tipo: "date", ajuda: "Deixe em branco para acesso sem prazo.", largo: true }],
            enviar: async (v) => { await Api.admin.alterarAutorizacao(doc.id, x.id, { validaAte: v.validaAte || null }); Adm.toast("Autorização atualizada."); recarregar(); } });
        }
        async function revogar(x) {
          if (!(await Adm.confirmar({ titulo: "Revogar acesso", perigo: true, botao: "Revogar", texto: `${x.nome} deixará de visualizar este documento.` }))) return;
          try { await Api.admin.revogarAutorizacao(doc.id, x.id); Adm.toast("Acesso revogado."); recarregar(); } catch (e) { Adm.falha(e); }
        }
      }
      recarregar();
    }
    function historico(d) {
      const corpo = el("div"), fechar = el("button", { type: "button", className: "btn", textContent: "Fechar" });
      const m = Adm.modal("Histórico: " + d.titulo, corpo, [fechar]); fechar.onclick = () => m.close();
      Adm.carregar(corpo, () => Api.admin.auditoria({ documento: d.id, limite: 20 }), (r, c) => c.append(r.itens.length
        ? Adm.tabela("Histórico do documento", [{ t: "Data/hora", f: (a) => dataHora(a.quando) }, { t: "Usuário", f: (a) => a.usuario }, { t: "Ação", f: (a) => ACOES_AUDITORIA[a.acao] || a.acao }], r.itens)
        : Adm.estado("vazio", "Sem registros", "Nenhuma atividade registrada para este documento.")));
    }
    async function excluir(d) {
      if (!(await Adm.confirmar({ titulo: "Excluir documento", perigo: true, botao: "Excluir", texto: `Excluir "${d.titulo}"? Esta ação não pode ser desfeita e fica registrada na auditoria.` }))) return;
      try { await Api.excluirDocumento(d.id); Adm.toast("Documento excluído."); lista.recarregar(); } catch (e) { Adm.falha(e); }
    }
    const idAcesso = new URLSearchParams(location.search).get("acesso");
    if (idAcesso && pode("documentos:permissoes")) { try { abrirAcesso(await Api.documento(idAcesso)); } catch (e) { Adm.falha(e); } }
  },

  async categorias(pode, main) {
    const novo = el("button", { type: "button", className: "btn btn-ouro", textContent: "+ Nova categoria", style: "margin-bottom:16px" });
    const alvo = el("div"); main.append(novo, alvo);
    const campos = [{ id: "nome", rotulo: "Nome", obrigatorio: true, max: 80, largo: true }, { id: "descricao", rotulo: "Descrição", tipo: "textarea", max: 200, largo: true }];
    const desenhar = () => Adm.carregar(alvo, () => Api.admin.categorias(), (cats, d) => {
      if (!cats.length) return d.append(Adm.estado("vazio", "Nenhuma categoria", "Cadastre a primeira categoria para organizar os documentos."));
      const btn = (txt, nome, fn, off, cls = "btn-vazado") => { const b = el("button", { type: "button", className: "btn btn-sm " + cls, textContent: txt, disabled: !!off }); b.setAttribute("aria-label", `${txt}: ${nome}`); b.onclick = fn; return b; };
      const mover = async (i, delta) => { const ids = cats.map((c) => c.id); [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]]; try { await Api.admin.ordenarCategorias(ids); desenhar(); } catch (e) { Adm.falha(e); } };
      d.append(el("p", { className: "contador", textContent: `${cats.length} categorias` }), Adm.tabela("Categorias", [
        { t: "Ordem", f: (c) => { const i = cats.indexOf(c); return el("div", { className: "acoes-linha" }, btn("↑", `subir ${c.nome}`, () => mover(i, -1), i === 0), btn("↓", `descer ${c.nome}`, () => mover(i, 1), i === cats.length - 1)); } },
        { t: "Nome", f: (c) => el("strong", { textContent: c.nome }) }, { t: "Descrição", f: (c) => c.descricao }, { t: "Documentos", f: (c) => String(c.total ?? 0) },
        { t: "Situação", f: (c) => Adm.badge(c.ativa === false ? "Inativa" : "Ativa", c.ativa === false ? "" : "ok") },
        { t: "Ações", f: (c) => el("div", { className: "acoes-linha" }, btn("Editar", c.nome, () => editar(c)),
          btn(c.ativa === false ? "Reativar" : "Desativar", c.nome, () => alternar(c), false, c.ativa === false ? "" : "btn-perigo")) }], cats));
      function editar(c) { Adm.formulario({ titulo: "Editar categoria", campos, valores: c, botao: "Salvar alterações", enviar: async (v) => { await Api.admin.editarCategoria(c.id, { nome: v.nome, descricao: v.descricao }); Adm.toast("Categoria atualizada."); desenhar(); } }); }
      async function alternar(c) {
        const reativar = c.ativa === false;
        if (!(await Adm.confirmar({ titulo: reativar ? "Reativar categoria" : "Desativar categoria", perigo: !reativar, botao: reativar ? "Reativar" : "Desativar",
          texto: reativar ? `"${c.nome}" voltará a aparecer para novos cadastros.` : `"${c.nome}" não aparecerá para novos cadastros. Os ${c.total ?? 0} documentos já vinculados continuam associados a ela.` }))) return;
        try { await Api.admin.editarCategoria(c.id, { ativa: reativar }); Adm.toast(reativar ? "Categoria reativada." : "Categoria desativada."); desenhar(); } catch (e) { Adm.falha(e); }
      }
    });
    novo.onclick = () => Adm.formulario({ titulo: "Nova categoria", campos, botao: "Cadastrar categoria", enviar: async (v) => { await Api.admin.criarCategoria(v); Adm.toast("Categoria cadastrada."); desenhar(); } });
    desenhar();
  },

  async auditoria(pode, main) {
    main.append(el("p", { className: "sub", textContent: "Registros das atividades realizadas na plataforma. Esta tela é apenas de consulta." }));
    const alvo = el("div"); main.append(alvo);
    Adm.listagem({
      destino: alvo, legenda: "Auditoria", vazio: "Nenhuma atividade encontrada para os filtros aplicados.", buscar: Api.admin.auditoria,
      campos: [{ id: "usuario", rotulo: "Usuário", dica: "Nome ou e-mail" }, { id: "acao", rotulo: "Tipo de atividade", tipo: "select", opcoes: Object.entries(ACOES_AUDITORIA).map(([valor, rotulo]) => ({ valor, rotulo })) },
        { id: "documento", rotulo: "Documento", dica: "Título ou código" }, { id: "de", rotulo: "De", tipo: "date" }, { id: "ate", rotulo: "Até", tipo: "date" }],
      colunas: [{ t: "Data/hora", f: (a) => dataHora(a.quando) }, { t: "Usuário", f: (a) => a.usuario }, { t: "Ação", f: (a) => ACOES_AUDITORIA[a.acao] || a.acao },
        { t: "Recurso afetado", f: (a) => recursoTxt(a.recurso) }, { t: "Detalhes", f: (a) => a.detalhes }],
    });
  },

  async configuracoes(pode, main) {
    main.append(el("p", { className: "sub", textContent: "Parâmetros gerais da Central. Autenticação, armazenamento e infraestrutura não são configurados por aqui." }));
    const alvo = el("div"); main.append(alvo);
    Adm.carregar(alvo, () => Api.admin.configuracoes(), (c, d) => {
      const tipos = [...new Set([...window.APP_CONFIG.TIPOS_ARQUIVO, ...(c.tiposArquivo || [])])];
      const lim = el("input", { id: "cfg-limite", type: "number", min: 1, max: 2048, required: true, value: c.limiteUploadMb });
      const msg = el("p", { className: "msg", role: "status" }), salvar = el("button", { className: "btn", textContent: "Salvar configurações" });
      const f = el("form", { className: "form-inline" },
        el("div", {}, el("label", { htmlFor: "cfg-limite", textContent: "Tamanho máximo de upload (MB)" }), lim),
        el("fieldset", {}, el("legend", { textContent: "Tipos de arquivo permitidos" }), el("div", { className: "checks" },
          ...tipos.map((t) => el("label", {}, el("input", { type: "checkbox", value: t, checked: (c.tiposArquivo || []).includes(t) }), "." + t)))), msg, el("div", {}, salvar));
      f.onsubmit = async (e) => {
        e.preventDefault(); msg.textContent = ""; msg.className = "msg";
        const sel = [...f.querySelectorAll("input[type=checkbox]:checked")].map((i) => i.value);
        if (!sel.length) { msg.textContent = "Selecione ao menos um tipo de arquivo."; msg.className = "msg erro"; return; }
        salvar.disabled = true;
        try { await Api.admin.salvarConfiguracoes({ limiteUploadMb: +lim.value, tiposArquivo: sel }); Adm.toast("Configurações salvas."); } catch (err) { Adm.falha(err); } finally { salvar.disabled = false; }
      };
      d.append(f);
    });
  },
};

(async () => {
  const k = document.body.dataset.pagina, [titulo, exige] = PAGINAS[k];
  const pode = await Adm.iniciar(k, titulo, exige);
  if (pode) await telas[k](pode, $("#conteudo")).catch((e) => $("#conteudo").append(Adm.erro(e)));
})();
