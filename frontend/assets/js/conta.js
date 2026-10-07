const $ = (s) => document.querySelector(s);
const campos = {
  nome: "nome",
  email: "email",
  CPF: "cpf",
  Telefone: "telefone",
  Cargo: "cargo",
  Nivel: "nivelAcesso",
  Departamento: "departamento",
};
const editaveis = ["nome", "Telefone"]; // o resto é definido pelo back (permissão), nunca pelo usuário
let editando = false;

Api.me()
  .then((u) => {
    for (const [id, chave] of Object.entries(campos))
      $("#" + id).value = u[chave] || "";
    if (u.fotoUrl) $("#foto-img").src = u.fotoUrl;
    $("#nome-topo").textContent = u.nome;
    $("#cargo-topo").textContent = u.cargo || "";
  })
  .catch((e) => aviso(e.message, "erro"));

function aviso(t, tipo) {
  $("#msg").textContent = t;
  $("#msg").className = "msg " + tipo;
}

$("#btn-editar").addEventListener("click", async (e) => {
  const btn = e.target;
  if (!editando) {
    editando = true;
    btn.textContent = "Salvar alterações";
    editaveis.forEach((id) => $("#" + id).removeAttribute("readonly"));
    $("#nome").focus();
    return;
  }
  btn.disabled = true;
  try {
    const dados = {
      nome: $("#nome").value.trim(),
      telefone: $("#Telefone").value.trim(),
    };
    await Api.atualizarMe(dados);
    $("#nome-topo").textContent = dados.nome;
    editaveis.forEach((id) => $("#" + id).setAttribute("readonly", ""));
    editando = false;
    btn.textContent = "Editar perfil";
    aviso("Perfil atualizado.", "ok");
  } catch (err) {
    aviso(err.message, "erro");
  } finally {
    btn.disabled = false;
  }
});

$("#foto").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (!f.type.startsWith("image/") || f.size > 5 * 1048576)
    return aviso("Escolha uma imagem de até 5 MB.", "erro");
  try {
    const r = await Api.enviarFoto(f);
    $("#foto-img").src = (r && r.fotoUrl) || URL.createObjectURL(f);
    aviso("Foto atualizada.", "ok");
  } catch (err) {
    aviso(err.message, "erro");
  }
});
$("#btn-sair").addEventListener("click", (e) => {
  e.preventDefault();
  Api.logout().finally(() => (location.href = "index.html"));
});
