// Componentes da área administrativa. Reutiliza $, el e dataBR (app.js) e a camada Api.
const PERMISSOES = {
  "documentos:visualizar": "Visualizar documentos",
  "documentos:cadastrar": "Cadastrar documentos",
  "documentos:editar": "Editar documentos",
  "documentos:excluir": "Excluir documentos",
  "documentos:permissoes": "Gerenciar acesso aos documentos",
  "usuarios:gerenciar": "Gerenciar usuários",
  "configuracoes:administrar": "Administrar configurações",
  "auditoria:consultar": "Consultar auditoria",
};
const PERMISSOES_ADMIN = ["usuarios:gerenciar", "configuracoes:administrar", "auditoria:consultar", "documentos:permissoes"];
const ACOES_AUDITORIA = {
  login: "Login", "documento.cadastro": "Cadastro de documento", "documento.edicao": "Edição de documento",
  "documento.exclusao": "Exclusão de documento", "documento.download": "Download de documento",
  "usuario.cadastro": "Cadastro de usuário", "usuario.edicao": "Edição de usuário",
  "permissao.alteracao": "Alteração de permissões", "documento.classificacao": "Alteração de classificação",
  "documento.acesso.concessao": "Acesso concedido a documento", "documento.acesso.alteracao": "Autorização alterada", "documento.acesso.revogacao": "Acesso revogado de documento", "usuario.bloqueio": "Bloqueio de conta", "usuario.reativacao": "Reativação de conta",
};
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const recursoTxt = (r) => (r ? `${r.nome || r.id || ""}${r.tipo ? ` (${r.tipo})` : ""}` : "—");

const Adm = {
  // Identifica o usuário, monta o cabeçalho/menu e bloqueia quem não tem permissão. Retorna pode() ou null.
  async iniciar(ativo, titulo, exige) {
    const main = $("#conteudo");
    document.title = `${titulo} - Administração SINDESEI-DF`;
    let me;
    try { me = await Api.me(); } catch (e) { main.append(Adm.erro(e)); return null; }
    const pode = (p) => (me.permissoes || []).includes(p);
    pode.me = me;
    const temAcesso = PERMISSOES_ADMIN.some(pode);
    Adm.montarShell(ativo, pode, temAcesso);
    if (!temAcesso || (exige && !pode(exige))) {
      main.append(Adm.estado("negado", "Acesso restrito", "Seu perfil não tem permissão para acessar esta área.",
        el("a", { className: "btn", href: "inicio.html", textContent: "Voltar à Central" })));
      return null;
    }
    main.prepend(el("h2", { textContent: titulo }));
    return pode;
  },

  montarShell(ativo, pode, temAcesso) {
    const topo = el("header", { className: "topo" },
      el("img", { className: "logo", src: "assets/logos/Sindesei-DF-branco.svg", alt: "SINDESEI-DF" }),
      el("div", { className: "titulo" }, el("h1", { textContent: "Administração" }), el("p", { textContent: "Central Digital de Documentos" })),
      el("div", { className: "acoes" },
        el("a", { className: "voltar", href: "inicio.html", textContent: "Voltar à Central" }),
        el("a", { href: "conta.html", "aria-label": "Minha conta" }, el("img", { src: "assets/icons/icon-imgPerson.svg", alt: "" }))));
    const grupos = [
      ["Visão geral", [["painel", "Painel", "admin.html", null, "iconHouse"]]],
      ["Pessoas", [["usuarios", "Usuários", "admin-usuarios.html", "usuarios:gerenciar", "icon-users"], ["perfis", "Perfis e permissões", "admin-perfis.html", "usuarios:gerenciar", "icon-shield"]]],
      ["Conteúdo", [["documentos", "Documentos", "admin-documentos.html", "documentos:visualizar", "iconDoc"], ["categorias", "Categorias", "admin-categorias.html", "configuracoes:administrar", "iconFile"]]],
      ["Governança", [["auditoria", "Auditoria", "admin-auditoria.html", "auditoria:consultar", "FileBarGraph"], ["configuracoes", "Configurações", "admin-configuracoes.html", "configuracoes:administrar", "icon-sliders"]]],
    ];
    const menu = el("nav", { className: "menu", "aria-label": "Administração" });
    if (temAcesso) grupos.forEach(([nome, itens]) => {
      const vis = itens.filter((i) => !i[3] || pode(i[3]));
      if (!vis.length) return;
      menu.append(el("p", { className: "grupo", textContent: nome }));
      vis.forEach(([id, rot, href, , ic]) => { const a = el("a", { href }, el("img", { src: `assets/icons/${ic}.svg`, alt: "" }), rot); if (id === ativo) a.setAttribute("aria-current", "page"); menu.append(a); });
    });
    document.body.prepend(el("a", { className: "pular", href: "#conteudo", textContent: "Pular para o conteúdo" }), topo, menu);
  },

  estado(tipo, titulo, texto, extra) {
    const e = el("div", { className: "estado " + tipo, role: tipo === "erro" || tipo === "negado" ? "alert" : "status" });
    if (tipo === "carregando") e.append(el("div", { className: "spin", "aria-hidden": "true" }));
    e.append(el("strong", { textContent: titulo }));
    if (texto) e.append(el("p", { textContent: texto }));
    if (extra) e.append(extra);
    return e;
  },

  erro(e, retentar) {
    if (e.pendente) {
      const est = Adm.estado("pendente", "Funcionalidade em implantação", "Este recurso estará disponível em breve.", window.APP_CONFIG.MODO_DEV ? el("code", { textContent: `${e.metodo} ${e.endpoint}` }) : undefined);
      est.dataset.endpoint = `${e.metodo} ${e.endpoint}`; console.info("Endpoint pendente:", est.dataset.endpoint); return est;
    }
    if (e.negado) return Adm.estado("negado", "Acesso negado", "Seu perfil não tem permissão para ver estas informações.");
    const b = retentar && el("button", { type: "button", className: "btn btn-sm", textContent: "Tentar novamente" });
    if (b) b.onclick = retentar;
    return Adm.estado("erro", "Não foi possível carregar", e.message, b || undefined);
  },

  async carregar(destino, buscar, desenhar) {
    const minha = (destino._req = (destino._req || 0) + 1); // ignora respostas antigas que chegarem depois de uma busca mais nova
    destino.replaceChildren(Adm.estado("carregando", "Carregando..."));
    try { const dados = await buscar(); if (minha !== destino._req) return; destino.replaceChildren(); desenhar(dados, destino); }
    catch (e) { if (minha === destino._req) destino.replaceChildren(Adm.erro(e, () => Adm.carregar(destino, buscar, desenhar))); }
  },

  toast(msg, tipo = "ok") {
    let r = $("#toasts");
    if (!r) { r = el("div", { id: "toasts", role: "status", "aria-live": "polite" }); r.setAttribute("popover", "manual"); document.body.append(r); }
    const t = el("div", { className: "toast " + tipo, textContent: msg }); r.append(t);
    // popover = camada superior da página: o aviso aparece acima de janelas modais abertas
    try { if (r.matches(":popover-open")) r.hidePopover(); r.showPopover(); } catch { /* navegador sem suporte: segue como elemento fixo */ }
    setTimeout(() => { t.remove(); if (!r.children.length) try { r.hidePopover(); } catch {} }, 6000);
  },
  msgFalha: (e) => (e.pendente ? "Esta operação ainda não está disponível." + (window.APP_CONFIG.MODO_DEV ? ` (${e.metodo} ${e.endpoint})` : "") : e.negado ? "Você não tem permissão para esta ação." : e.message),
  falha(e) { Adm.toast(Adm.msgFalha(e), "erro"); },

  modal(titulo, corpo, botoes = []) {
    const idT = "m-titulo-" + (Adm._n = (Adm._n || 0) + 1), d = el("dialog", { className: "modal", "aria-labelledby": idT });
    d.append(el("h2", { id: idT, textContent: titulo }), corpo);
    if (botoes.length) d.append(el("div", { className: "acoes" }, ...botoes));
    d.addEventListener("close", () => d.remove());
    document.body.append(d); d.showModal(); return d;
  },

  confirmar({ titulo, texto, botao = "Confirmar", perigo = false }) {
    return new Promise((res) => {
      const cancelar = el("button", { type: "button", className: "btn btn-vazado", textContent: "Cancelar" });
      const ok = el("button", { type: "button", className: "btn" + (perigo ? " btn-perigo" : ""), textContent: botao });
      const d = Adm.modal(titulo, el("p", { textContent: texto }), [cancelar, ok]);
      let r = false; cancelar.onclick = () => d.close(); ok.onclick = () => { r = true; d.close(); };
      d.addEventListener("close", () => res(r));
    });
  },

  // campos: [{ id, rotulo, tipo, opcoes:[{valor,rotulo}], obrigatorio, dica, ajuda, largo, desabilitado, max }]
  formulario({ titulo, campos, valores = {}, enviar, botao = "Salvar", info }) {
    const f = el("form", { className: "form-adm" });
    if (info) f.append(el("p", { className: "sub", textContent: info }));
    const grade = el("div", { className: "duas" }); f.append(grade);
    const ents = {};
    campos.forEach((c) => {
      const id = "f-" + c.id;
      const ent = c.tipo === "select" ? el("select", { id }, ...(c.opcoes || []).map((o) => el("option", { value: o.valor, textContent: o.rotulo })))
        : c.tipo === "textarea" ? el("textarea", { id, maxLength: c.max || 1000 })
        : el("input", { id, type: c.tipo || "text", maxLength: c.max || 200, placeholder: c.dica || "" });
      ent.required = !!c.obrigatorio; ent.name = c.id; ent.disabled = !!c.desabilitado; ent.value = valores[c.id] ?? "";
      ents[c.id] = ent;
      grade.append(el("div", { className: c.largo ? "largo" : "" }, el("label", { htmlFor: id, textContent: c.rotulo + (c.obrigatorio ? " *" : "") }), ent, c.ajuda ? el("small", { className: "ajuda", textContent: c.ajuda }) : ""));
    });
    const msg = el("p", { className: "msg erro", role: "alert" });
    const cancelar = el("button", { type: "button", className: "btn btn-vazado", textContent: "Cancelar" });
    const salvar = el("button", { className: "btn", textContent: botao });
    f.append(msg, el("div", { className: "acoes" }, cancelar, salvar));
    const d = Adm.modal(titulo, f);
    cancelar.onclick = () => d.close();
    f.onsubmit = async (e) => {
      e.preventDefault(); msg.textContent = ""; salvar.disabled = true;
      const dados = Object.fromEntries(Object.entries(ents).map(([k, v]) => [k, v.value.trim()]));
      try { if ((await enviar(dados)) !== false) d.close(); } catch (err) { msg.textContent = Adm.msgFalha(err); } finally { salvar.disabled = false; }
    };
    return d;
  },

  tabela(legenda, colunas, linhas) {
    return el("div", { className: "rolagem" }, el("table", { className: "tab" },
      el("caption", { className: "sr-only", textContent: legenda }),
      el("thead", {}, el("tr", {}, ...colunas.map((c) => el("th", { scope: "col", textContent: c.t })))),
      el("tbody", {}, ...linhas.map((l) => el("tr", {}, ...colunas.map((c) => el("td", {}, c.f(l) ?? "—")))))));
  },

  badge: (txt, tipo = "") => el("span", { className: "badge " + tipo, textContent: txt }),

  pager(r, ir) {
    if (!r.totalPaginas || r.totalPaginas <= 1) return "";
    const b = (txt, p, off) => { const x = el("button", { type: "button", className: "btn btn-vazado btn-sm", textContent: txt, disabled: off }); x.onclick = () => ir(p); return x; };
    return el("nav", { className: "pager", "aria-label": "Paginação" }, b("Anterior", r.pagina - 1, r.pagina <= 1),
      el("span", { textContent: `Página ${r.pagina} de ${r.totalPaginas}` }), b("Próxima", r.pagina + 1, r.pagina >= r.totalPaginas));
  },

  // Listagem com filtros, estados e paginação. buscar(params) -> { itens, total, pagina, limite, totalPaginas }
  listagem({ destino, campos, buscar, colunas, legenda, vazio = "Nenhum resultado encontrado.", limite = 20 }) {
    let pagina = 1, t;
    const form = el("form", { className: "filtros", role: "search", "aria-label": "Filtros de " + legenda.toLowerCase() });
    const resultado = el("div", { className: "resultado" });
    const valores = () => Object.fromEntries(campos.map((c) => [c.id, $("#flt-" + c.id, form).value.trim()]));
    campos.forEach((c) => {
      const id = "flt-" + c.id, imediato = c.tipo === "select" || c.tipo === "date";
      const ent = c.tipo === "select"
        ? el("select", { id }, el("option", { value: "", textContent: c.todos || "Todos" }), ...(c.opcoes || []).map((o) => el("option", { value: o.valor, textContent: o.rotulo })))
        : el("input", { id, type: c.tipo || "text", placeholder: c.dica || "" });
      ent.addEventListener(imediato ? "change" : "input", () => { pagina = 1; clearTimeout(t); t = setTimeout(recarregar, imediato ? 0 : 300); });
      form.append(el("div", { className: "campo" }, el("label", { htmlFor: id, textContent: c.rotulo }), ent));
    });
    const limpar = el("button", { type: "button", className: "btn btn-vazado btn-sm", textContent: "Limpar filtros" });
    limpar.onclick = () => { form.reset(); pagina = 1; recarregar(); };
    form.append(limpar); form.onsubmit = (e) => { e.preventDefault(); pagina = 1; recarregar(); };
    destino.append(form, resultado);
    function recarregar() {
      return Adm.carregar(resultado, () => buscar({ ...valores(), pagina, limite }), (r) => {
        resultado.append(el("p", { className: "contador", role: "status", textContent: `${r.total} ${r.total === 1 ? "resultado" : "resultados"}` }));
        if (!r.itens.length) return resultado.append(Adm.estado("vazio", "Nada por aqui", vazio));
        resultado.append(Adm.tabela(legenda, colunas, r.itens), Adm.pager(r, (p) => { pagina = p; recarregar(); }));
      });
    }
    recarregar();
    return { recarregar };
  },
};
