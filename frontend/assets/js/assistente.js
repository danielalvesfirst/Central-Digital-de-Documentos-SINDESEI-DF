// Interface do Assistente IA. Contrato proposto em docs/API.md. Nenhuma resposta, fonte ou sugestão é simulada:
// sem o servidor de IA, a tela fica em "implantação". Quem decide o que a IA pode ver é o servidor (permissões do usuário).
(async () => {
  const main = $("#conteudo"), pode = await sessao();
  Shell.montar("assistente", "Assistente IA", "Perguntas e apoio ao cadastro de documentos", pode);
  let conversaId = null, disponivel = false, cats = [], docEscolhido = null, ocupado = false;
  const SUGESTOES = ["Quais atas foram registradas neste ano?", "Resuma o documento mais recente sobre convenção coletiva.", "Quais documentos tratam de reajuste salarial?", "Há ofícios enviados recentemente?"];
  const paragrafos = (txt) => String(txt || "").split(/\n+/).filter(Boolean).map((p) => el("p", { textContent: p }));
  const aviso = el("div", { id: "ia-aviso" });
  const msgErro = (e) => (e.pendente ? "" : e.negado ? "Você não tem permissão para usar o Assistente IA." : e.message);

  // ---------- histórico
  const histLista = el("ul", { className: "ia-hist-lista" }), histMsg = el("p", { className: "contador", role: "status" });
  const nova = el("button", { type: "button", className: "btn btn-sm", textContent: "Nova conversa" });
  const hist = el("details", { className: "ia-hist" }, el("summary", { textContent: "Histórico de conversas" }), nova, histMsg, histLista);
  hist.open = matchMedia("(min-width: 900px)").matches;
  async function carregarHistorico() {
    histMsg.textContent = "Carregando conversas..."; histLista.replaceChildren();
    try {
      const lista = await Api.ia.conversas(); disponivel = true; aviso.replaceChildren(); habilitar(true);
      histMsg.textContent = lista.length ? "" : "Nenhuma conversa ainda.";
      histLista.replaceChildren(...lista.map((c) => { const b = el("button", { type: "button", className: "ia-hist-item", textContent: c.titulo || "Conversa" }); b.onclick = () => abrirConversa(c.id); return el("li", {}, b); }));
    } catch (e) {
      disponivel = false; habilitar(false); histMsg.textContent = "";
      aviso.replaceChildren(e.pendente
        ? el("div", { className: "ia-aviso", role: "status" }, el("strong", { textContent: "Assistente IA em implantação" }), el("p", { textContent: "Em breve você poderá fazer perguntas sobre os documentos da Central. Enquanto isso, use a busca e os filtros da lista de documentos." }), el("a", { href: "documentos.html", textContent: "Ir para os documentos" }))
        : el("div", { className: "ia-aviso erro", role: "alert" }, el("strong", { textContent: "Não foi possível carregar o assistente" }), el("p", { textContent: msgErro(e) }), (() => { const b = el("button", { type: "button", className: "btn btn-sm", textContent: "Tentar novamente" }); b.onclick = carregarHistorico; return b; })()));
    }
  }

  // ---------- conversa
  const log = el("div", { className: "ia-log", role: "log", "aria-live": "polite", "aria-label": "Conversa" });
  const texto = el("textarea", { id: "ia-texto", rows: 2, maxLength: 2000, placeholder: "Escreva sua pergunta..." });
  const enviarBtn = el("button", { className: "btn", textContent: "Enviar" });
  const form = el("form", { className: "ia-form" }, el("label", { className: "sr-only", htmlFor: "ia-texto", textContent: "Sua pergunta" }), texto, enviarBtn);
  function habilitar(on) { [texto, enviarBtn, ...ferramentasAtivaveis].forEach((x) => x && (x.disabled = !on)); log.querySelectorAll(".ia-sug").forEach((b) => (b.disabled = !on)); }
  function boasVindas() {
    log.replaceChildren(el("div", { className: "ia-boasvindas" }, el("h3", { textContent: "Como posso ajudar?" }), el("p", { className: "sub", textContent: "Faça uma pergunta ou escolha uma sugestão." }),
      ...SUGESTOES.map((s) => { const b = el("button", { type: "button", className: "ia-sug", textContent: s, disabled: !disponivel }); b.onclick = () => { texto.value = s; texto.focus(); }; return b; })));
  }
  function fontes(m) {
    const f = Array.isArray(m.fontes) ? m.fontes : [];
    return el("div", { className: "fontes" }, el("strong", { textContent: "Fontes" }),
      f.length ? el("ul", {}, ...f.map((x) => el("li", {}, el("a", { href: "documento.html?id=" + encodeURIComponent(x.documentoId), textContent: x.titulo || "Documento " + x.documentoId }), x.trecho ? el("small", { textContent: x.trecho }) : "")))
        : el("p", { className: "sem-fontes", textContent: "Esta resposta não citou documentos." }));
  }
  function mostrar(m) {
    if (log.querySelector(".ia-boasvindas")) log.replaceChildren();
    const usuario = m.papel === "usuario";
    log.append(el("article", { className: "msg-ia " + (usuario ? "usuario" : "assistente") }, el("span", { className: "sr-only", textContent: usuario ? "Você disse:" : "Assistente respondeu:" }), ...paragrafos(m.texto), usuario ? "" : fontes(m)));
    log.scrollTop = log.scrollHeight;
  }
  async function abrirConversa(id) {
    log.replaceChildren(el("p", { className: "carregando", role: "status", textContent: "Carregando conversa..." }));
    try { const c = await Api.ia.conversa(id); conversaId = c.id; log.replaceChildren(); (c.mensagens || []).forEach(mostrar); if (!(c.mensagens || []).length) boasVindas(); }
    catch (e) { log.replaceChildren(el("p", { className: "msg erro", role: "alert", textContent: msgErro(e) || "Não foi possível abrir a conversa." })); }
  }
  async function responder(pergunta) {
    ocupado = true; habilitar(false);
    const proc = el("p", { className: "msg-ia processando", role: "status", textContent: "O assistente está preparando a resposta..." }); log.append(proc); log.scrollTop = log.scrollHeight;
    try {
      const r = await Api.ia.perguntar(conversaId, pergunta); proc.remove();
      const novaConversa = !conversaId; conversaId = r.conversaId || conversaId; mostrar(r.mensagem); if (novaConversa) carregarHistorico();
    } catch (e) {
      proc.remove();
      const b = el("button", { type: "button", className: "btn btn-sm", textContent: "Tentar novamente" });
      const bloco = el("div", { className: "msg-ia erro", role: "alert" }, el("p", { textContent: e.pendente ? "O Assistente IA ainda não está disponível." : "Não foi possível obter a resposta. " + msgErro(e) }), e.pendente ? "" : b);
      b.onclick = () => { bloco.remove(); responder(pergunta); }; log.append(bloco);
    } finally { ocupado = false; habilitar(disponivel); texto.focus(); }
  }
  form.onsubmit = (e) => { e.preventDefault(); const p = texto.value.trim(); if (!p || ocupado || !disponivel) return; texto.value = ""; mostrar({ papel: "usuario", texto: p }); responder(p); };
  texto.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
  nova.onclick = () => { conversaId = null; boasVindas(); texto.focus(); };

  // ---------- ferramentas (resumo e sugestões revisáveis; nada é alterado sem confirmação)
  const buscaDoc = el("input", { type: "search", id: "ia-busca", placeholder: "Buscar o documento por título", "aria-label": "Buscar documento" });
  const resultados = el("div", { className: "ia-resultados", "aria-live": "polite" }), saida = el("div", { className: "ia-saida", "aria-live": "polite" });
  const bResumo = el("button", { type: "button", className: "btn btn-sm", textContent: "Resumir documento", disabled: true });
  const bSug = el("button", { type: "button", className: "btn btn-sm", textContent: "Sugerir categoria, palavras-chave e descrição", disabled: true });
  const ferramentasAtivaveis = [buscaDoc];
  let tmr;
  async function buscarDocs() {
    resultados.replaceChildren(el("p", { className: "contador", textContent: "Buscando..." })); docEscolhido = null; bResumo.disabled = bSug.disabled = true;
    try {
      const r = await Api.documentos({ busca: buscaDoc.value.trim(), limite: 6 });
      resultados.replaceChildren(r.itens.length ? el("fieldset", {}, el("legend", { className: "sr-only", textContent: "Documentos encontrados" }), ...r.itens.map((d) => el("label", {}, el("input", { type: "radio", name: "ia-doc", value: d.id }), d.titulo))) : el("p", { className: "contador", textContent: "Nenhum documento encontrado." }));
    } catch (e) { resultados.replaceChildren(el("p", { className: "msg erro", role: "alert", textContent: e.message })); }
  }
  buscaDoc.oninput = () => { clearTimeout(tmr); tmr = setTimeout(buscarDocs, 300); };
  resultados.onchange = () => { const c = resultados.querySelector("input:checked"); docEscolhido = c ? c.value : null; bResumo.disabled = bSug.disabled = !docEscolhido || !disponivel; };
  const falha = (e) => el("p", { className: "msg erro", role: "alert", textContent: e.pendente ? "Esta função do assistente ainda não está disponível." : e.negado ? "Você não tem permissão para usar esta função." : e.message });
  bResumo.onclick = async () => {
    saida.replaceChildren(el("p", { className: "carregando", role: "status", textContent: "Gerando resumo..." }));
    try { const r = await Api.ia.resumir(docEscolhido); saida.replaceChildren(el("div", { className: "ia-card" }, el("h4", { textContent: "Resumo" }), ...paragrafos(r.resumo), fontes(r))); } catch (e) { saida.replaceChildren(falha(e)); }
  };
  bSug.onclick = async () => {
    saida.replaceChildren(el("p", { className: "carregando", role: "status", textContent: "Gerando sugestões..." }));
    try {
      const s = await Api.ia.sugerir(docEscolhido);
      const campo = (id, rot, ent) => el("div", { className: "campo" }, el("label", { htmlFor: id, textContent: rot }), ent);
      const cat = el("select", { id: "sg-cat" }, el("option", { value: "", textContent: "Manter a categoria atual" }), ...cats.map((c) => el("option", { value: c.id, textContent: c.nome }))); cat.value = cats.some((c) => c.id === s.categoria) ? s.categoria : "";
      const kw = el("input", { id: "sg-kw", value: (s.palavrasChave || []).join(", ") }), ass = el("input", { id: "sg-ass", value: s.assunto || "" }), desc = el("textarea", { id: "sg-desc", rows: 3, value: s.descricao || "" });
      const aplicar = el("button", { type: "button", className: "btn btn-sm", textContent: "Revisar e aplicar ao documento", hidden: !pode("documentos:editar") });
      const descartar = el("button", { type: "button", className: "btn btn-sm btn-vazado", textContent: "Descartar sugestões" });
      descartar.onclick = () => saida.replaceChildren();
      aplicar.onclick = async () => {
        try {
          const d = await Api.documento(docEscolhido);
          Cadastro.abrir(() => { toast("Documento atualizado."); saida.replaceChildren(); }, { ...d, categoria: cat.value || d.categoria, palavrasChave: kw.value.split(",").map((x) => x.trim()).filter(Boolean), assunto: ass.value, descricao: desc.value }, { classificar: pode("documentos:permissoes") });
        } catch (e) { toast(e.message, "erro"); }
      };
      saida.replaceChildren(el("div", { className: "ia-card" }, el("h4", { textContent: "Sugestões para revisar" }), el("p", { className: "sub", textContent: "Edite o que quiser. Nada é salvo até você confirmar no formulário do documento." }),
        campo("sg-cat", "Categoria", cat), campo("sg-kw", "Palavras-chave (separe por vírgula)", kw), campo("sg-ass", "Assunto", ass), campo("sg-desc", "Descrição", desc), el("div", { className: "acoes-linha" }, aplicar, descartar)));
    } catch (e) { saida.replaceChildren(falha(e)); }
  };
  const ferramentas = el("section", { className: "ia-ferr", role: "tabpanel", hidden: true }, el("h3", { textContent: "Ferramentas de documento" }),
    el("p", { className: "sub", textContent: "Resumo e sugestões de metadados. A IA nunca altera um documento sozinha." }),
    el("div", { className: "campo" }, el("label", { htmlFor: "ia-busca", textContent: "Documento" }), buscaDoc), resultados, el("div", { className: "acoes-linha" }, bResumo, bSug), saida);

  // ---------- abas
  const painelConversa = el("section", { className: "ia-conversa", role: "tabpanel" }, log, form);
  const abas = ["Conversa", "Ferramentas de documento"].map((n, i) => el("button", { type: "button", role: "tab", textContent: n, "aria-selected": String(i === 0) }));
  abas.forEach((b, i) => (b.onclick = () => { abas.forEach((x, j) => x.setAttribute("aria-selected", String(i === j))); painelConversa.hidden = i !== 0; ferramentas.hidden = i !== 1; if (i === 1 && !resultados.children.length) buscarDocs(); }));

  main.append(el("h2", { textContent: "Assistente IA" }), aviso,
    el("div", { className: "ia" }, hist, el("div", { className: "ia-main" }, el("div", { className: "abas", role: "tablist" }, ...abas), painelConversa, ferramentas)));
  boasVindas(); habilitar(false);
  try { cats = await Api.categorias(); } catch { cats = []; }
  carregarHistorico();
})().catch((e) => { $("#conteudo").append(el("p", { className: "msg erro", role: "alert", textContent: e.negado ? "Você não tem permissão para acessar esta página." : e.message })); });
