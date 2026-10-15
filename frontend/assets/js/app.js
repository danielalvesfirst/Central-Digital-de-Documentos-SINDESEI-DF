// Utilitários, menu/cabeçalho e popup de cadastro, compartilhados pelas telas internas
const $ = (s, r = document) => r.querySelector(s);
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props))
    k.startsWith("aria-") ? e.setAttribute(k, v) : (e[k] = v);
  kids.forEach((k) => e.append(k));
  return e;
}
const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const dataBR = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d} ${MESES[m - 1]} ${y}`;
};
const tamanho = (b) =>
  b > 1e6
    ? (b / 1e6).toFixed(1).replace(".", ",") + " MB"
    : Math.max(1, Math.round(b / 1e3)) + " KB";
const ICONES = {
  pdf: "iconPDF",
  txt: "iconTXT",
  xls: "iconTabela",
  xlsx: "iconTabela",
  doc: "iconDoc",
  docx: "iconDoc",
};
const iconeTipo = (t) => `assets/icons/${ICONES[t] || "iconFile"}.svg`;

const Shell = {
  montar(ativo, titulo, sub, pode = () => true) {
    const topo = el(
      "header",
      { className: "topo" },
      el("img", {
        className: "logo",
        src: "assets/logos/Sindesei-DF-branco.svg",
        alt: "SINDESEI-DF",
      }),
      el(
        "div",
        { className: "titulo" },
        el("h1", { textContent: titulo }),
        sub ? el("p", { textContent: sub }) : "",
      ),
      el(
        "div",
        { className: "acoes" },
        el(
          "a",
          { href: "conta.html", "aria-label": "Minha conta" },
          el("img", { src: "assets/icons/icon-imgPerson.svg", alt: "" }),
        ),
      ),
    );
    const itens = [
      ["inicio", "Início", "iconHouse", "inicio.html"],
      ["documentos", "Documentos", "iconDoc", "documentos.html"],
      ["categorias", "Categorias", "iconFile", "categorias.html"],
      ["novo", "Cadastrar documentos", "icon-addDoc", "documentos.html?novo=1"],
    ];
    const menu = el(
      "nav",
      { className: "menu", "aria-label": "Principal" },
      ...itens
        .filter((i) => i[0] !== "novo" || pode("documentos:cadastrar"))
        .map(([id, nome, ic, href]) => {
          const a = el(
            "a",
            { href },
            el("img", { src: `assets/icons/${ic}.svg`, alt: "" }),
            nome,
          );
          if (id === ativo) a.setAttribute("aria-current", "page");
          return a;
        }),
    );
    document.body.prepend(topo, menu);
  },
};

const Cadastro = {
  dlg: null,
  // doc informado = modo edição; sem doc = novo cadastro
  async abrir(aoSalvar, doc = null) {
    this.aoSalvar = aoSalvar;
    this.doc = doc;
    if (!this.dlg) await this.criar();
    const d = this.dlg,
      v = (id, val) => {
        $("#" + id, d).value = val;
      };
    $("h2", d).textContent = doc
      ? "Editar documento"
      : "Cadastrar novo documento";
    v("c-titulo", doc ? doc.titulo : "");
    v("c-cat", doc ? doc.categoria : $("#c-cat", d).options[0].value);
    v("c-data", doc ? doc.data : new Date().toISOString().slice(0, 10));
    v("c-kw", doc ? (doc.palavrasChave || []).join(", ") : "");
    v("c-assunto", doc ? doc.assunto : "");
    v("c-desc", doc ? doc.descricao || "" : "");
    v("c-arq", "");
    $("#c-msg", d).textContent = "";
    $("#c-nome", d).textContent = doc
      ? "Clique para trocar o arquivo (opcional)"
      : `Clique aqui para enviar o arquivo (até ${window.APP_CONFIG.MAX_MB} MB)`;
    d.showModal();
  },
  async criar() {
    const { MAX_MB, TIPOS_ARQUIVO } = window.APP_CONFIG,
      cats = await Api.categorias();
    const d = (this.dlg = el("dialog"));
    d.innerHTML = `<form><h2>Cadastrar novo documento</h2><p class="sub">Preencha as informações para registrar o documento.</p>
      <label for="c-titulo">Nome do documento</label><input id="c-titulo" required maxlength="120" placeholder="Ex: Ofício institucional">
      <div class="duas"><div><label for="c-cat">Categoria</label><select id="c-cat" required></select></div>
      <div><label for="c-data">Data</label><input type="date" id="c-data" required></div></div>
      <label for="c-kw">Palavras-chave (separe por vírgula)</label><input id="c-kw" placeholder="Ex: ofício, solicitação">
      <label for="c-assunto">Assunto</label><input id="c-assunto" required maxlength="200" placeholder="Ex: Solicitação de informações e providências">
      <label for="c-desc">Descrição</label><textarea id="c-desc" maxlength="1000"></textarea>
      <label for="c-arq">Arquivo (opcional)</label><label class="drop"><input type="file" id="c-arq" accept="${TIPOS_ARQUIVO.map((t) => "." + t)}"><span id="c-nome">Clique aqui para enviar o arquivo (até ${MAX_MB} MB)</span></label>
      <p id="c-msg" class="msg" role="alert"></p>
      <div class="acoes"><button type="button" class="btn btn-vazado" id="c-cancelar">Cancelar</button><button class="btn">Salvar</button></div></form>`;
    $("#c-cat", d).append(
      ...cats.map((c) => el("option", { value: c.id, textContent: c.nome })),
    );
    document.body.append(d);
    $("#c-cancelar", d).onclick = () => d.close();
    $("#c-arq", d).onchange = (e) => {
      const f = e.target.files[0];
      $("#c-nome", d).textContent = f
        ? f.name
        : `Clique aqui para enviar o arquivo (até ${MAX_MB} MB)`;
    };
    $("form", d).onsubmit = async (e) => {
      e.preventDefault();
      // Validação só por conveniência do usuário; a validação de verdade (tipo real, vírus, tamanho) é do servidor.
      const f = $("#c-arq", d).files[0],
        erro = (m) => {
          $("#c-msg", d).textContent = m;
          $("#c-msg", d).className = "msg erro";
        };
      if (f && !TIPOS_ARQUIVO.includes(f.name.split(".").pop().toLowerCase()))
        return erro("Tipo de arquivo não permitido.");
      if (f && f.size > MAX_MB * 1048576)
        return erro(`O arquivo passa de ${MAX_MB} MB.`);
      const fd = new FormData();
      [
        ["titulo", "c-titulo"],
        ["categoria", "c-cat"],
        ["data", "c-data"],
        ["palavrasChave", "c-kw"],
        ["assunto", "c-assunto"],
        ["descricao", "c-desc"],
      ].forEach(([k, id]) => fd.append(k, $("#" + id, d).value.trim()));
      if (f) fd.append("arquivo", f);
      try {
        await (this.doc
          ? Api.editarDocumento(this.doc.id, fd)
          : Api.cadastrarDocumento(fd));
        d.close();
        this.aoSalvar();
      } catch (err) {
        erro(err.message);
      }
    };
  },
};
