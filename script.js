const formulario = document.querySelector("#form-tarefa");
const campoTitulo = document.querySelector("#titulo");
const campoDescricao = document.querySelector("#descricao");
const campoResponsavel = document.querySelector("#responsavel");
const campoPrazo = document.querySelector("#prazo");

const lista = document.querySelector(".lista-tarefas");
const filtroStatus = document.querySelector("#filtro-status");
const filtroResponsavel = document.querySelector("#filtro-responsavel");
const contador = document.querySelector(".tarefas > p");
const botaoSalvar = formulario.querySelector('button[type="submit"]');

let tarefas = [];
let idEmEdicao = null;
let ocupado = false;

// Faz uma chamada à API e trata respostas com erro.
async function chamarAPI(caminho, metodo = "GET", dados) {
  const opcoes = { method: metodo };

  if (dados !== undefined) {
    opcoes.headers = { "Content-Type": "application/json" };
    opcoes.body = JSON.stringify(dados);
  }

  const resposta = await fetch(caminho, opcoes);

  if (!resposta.ok) {
    const mensagem = await resposta.text();
    throw new Error(mensagem.trim() || "Erro ao acessar a API.");
  }

  if (resposta.status === 204) return null;

  return resposta.json();
}

async function carregarTarefas() {
  try {
    tarefas = await chamarAPI("/tarefas");
    renderizarTarefas();
  } catch (erro) {
    contador.textContent = "Não foi possível carregar as tarefas.";
    alert(erro.message);
  }
}

function formatarPrazo(prazo) {
  if (!prazo) return "sem prazo";

  const [ano, mes, dia] = prazo.split("-");
  return `${dia}/${mes}/${ano}`;
}

function dataDeHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);

  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;

  return elemento;
}

function criarBotao(texto, acao, id) {
  const botao = criarElemento("button", "", texto);

  botao.type = "button";
  botao.dataset.acao = acao;
  botao.dataset.id = id;
  botao.disabled = ocupado;

  return botao;
}

function definirOcupado(valor) {
  ocupado = valor;
  botaoSalvar.disabled = valor;

  lista.querySelectorAll("button, select").forEach(elemento => {
    elemento.disabled = valor;
  });
}

function encerrarEdicao() {
  idEmEdicao = null;
  formulario.reset();
  botaoSalvar.textContent = "Adicionar tarefa";
}

function renderizarTarefas() {
  const pesquisa = filtroResponsavel.value
    .trim()
    .toLocaleLowerCase("pt-BR");

  const filtradas = tarefas.filter(tarefa => {
    const statusCorreto =
      !filtroStatus.value || tarefa.status === filtroStatus.value;

    const responsavelCorreto = tarefa.responsavel
      .toLocaleLowerCase("pt-BR")
      .includes(pesquisa);

    return statusCorreto && responsavelCorreto;
  });

  contador.textContent =
    `Mostrando ${filtradas.length} de ${tarefas.length} tarefas`;

  lista.replaceChildren();

  if (filtradas.length === 0) {
    lista.append(criarElemento("li", "", "Nenhuma tarefa encontrada."));
    return;
  }

  const nomesStatus = {
    pendente: "Pendente",
    "em-andamento": "Em andamento",
    concluida: "Concluída"
  };

  filtradas.forEach(tarefa => {
    const item = criarElemento("li");
    const artigo = criarElemento("article", "tarefa");
    const cabecalho = criarElemento("header", "tarefa-cabecalho");
    const indicadores = criarElemento("div", "indicadores");

    indicadores.append(
      criarElemento("span", "status", nomesStatus[tarefa.status])
    );

    if (
      tarefa.prazo &&
      tarefa.prazo < dataDeHoje() &&
      tarefa.status !== "concluida"
    ) {
      indicadores.append(criarElemento("span", "atrasada", "Atrasada"));
    }

    cabecalho.append(
      criarElemento("h3", "", tarefa.titulo),
      indicadores
    );

    artigo.append(cabecalho);

    if (tarefa.descricao) {
      artigo.append(criarElemento("p", "", tarefa.descricao));
    }

    const rodape = criarElemento("footer", "tarefa-rodape");
    const detalhes = criarElemento("div", "tarefa-detalhes");

    detalhes.append(
      criarElemento("span", "", `Responsável: ${tarefa.responsavel}`),
      criarElemento("span", "", `Prazo: ${formatarPrazo(tarefa.prazo)}`)
    );

    const acoes = criarElemento("div", "tarefa-acoes");
    const seletor = criarElemento("select");

    seletor.dataset.id = tarefa.id;
    seletor.disabled = ocupado;
    seletor.setAttribute("aria-label", `Status: ${tarefa.titulo}`);

    Object.entries(nomesStatus).forEach(([valor, nome]) => {
      const opcao = criarElemento("option", "", nome);
      opcao.value = valor;
      seletor.append(opcao);
    });

    seletor.value = tarefa.status;

    acoes.append(
      seletor,
      criarBotao("Editar", "editar", tarefa.id),
      criarBotao("Excluir", "excluir", tarefa.id)
    );

    rodape.append(detalhes, acoes);
    artigo.append(rodape);
    item.append(artigo);
    lista.append(item);
  });
}

formulario.addEventListener("submit", async evento => {
  evento.preventDefault();

  if (ocupado) return;

  const dados = {
    titulo: campoTitulo.value.trim(),
    descricao: campoDescricao.value.trim(),
    responsavel: campoResponsavel.value.trim(),
    prazo: campoPrazo.value
  };

  if (!dados.titulo || !dados.responsavel) {
    alert("Preencha o título e o responsável.");
    return;
  }

  const tarefaAtual = tarefas.find(tarefa => tarefa.id === idEmEdicao);

  if (idEmEdicao !== null && !tarefaAtual) {
    alert("Tarefa não encontrada. Recarregue a página.");
    return;
  }

  definirOcupado(true);

  try {
    if (tarefaAtual) {
      const atualizada = await chamarAPI(
        `/tarefas/${idEmEdicao}`,
        "PUT",
        { ...dados, status: tarefaAtual.status }
      );

      tarefas = tarefas.map(tarefa =>
        tarefa.id === atualizada.id ? atualizada : tarefa
      );
    } else {
      const criada = await chamarAPI("/tarefas", "POST", dados);
      tarefas.unshift(criada);
    }

    encerrarEdicao();
    renderizarTarefas();
  } catch (erro) {
    alert(erro.message);
  } finally {
    definirOcupado(false);
  }
});

lista.addEventListener("click", async evento => {
  const botao = evento.target.closest("button[data-acao]");

  if (!botao || ocupado) return;

  // Os IDs do PostgreSQL são números.
  const id = Number(botao.dataset.id);
  const tarefa = tarefas.find(tarefa => tarefa.id === id);

  if (!tarefa) return;

  if (botao.dataset.acao === "editar") {
    idEmEdicao = id;

    campoTitulo.value = tarefa.titulo;
    campoDescricao.value = tarefa.descricao;
    campoResponsavel.value = tarefa.responsavel;
    campoPrazo.value = tarefa.prazo;

    botaoSalvar.textContent = "Salvar alterações";
    campoTitulo.focus();
    return;
  }

  if (botao.dataset.acao === "excluir") {
    if (!confirm(`Excluir a tarefa "${tarefa.titulo}"?`)) return;

    definirOcupado(true);

    try {
      await chamarAPI(`/tarefas/${id}`, "DELETE");

      tarefas = tarefas.filter(tarefa => tarefa.id !== id);

      if (idEmEdicao === id) encerrarEdicao();

      renderizarTarefas();
    } catch (erro) {
      alert(erro.message);
    } finally {
      definirOcupado(false);
    }
  }
});

lista.addEventListener("change", async evento => {
  const seletor = evento.target;

  if (!seletor.matches("select[data-id]") || ocupado) return;

  const id = Number(seletor.dataset.id);
  const tarefa = tarefas.find(tarefa => tarefa.id === id);

  if (!tarefa) return;

  definirOcupado(true);

  try {
    const atualizada = await chamarAPI(`/tarefas/${id}`, "PUT", {
      ...tarefa,
      status: seletor.value
    });

    tarefas = tarefas.map(tarefa =>
      tarefa.id === id ? atualizada : tarefa
    );

    renderizarTarefas();
  } catch (erro) {
    seletor.value = tarefa.status;
    alert(erro.message);
  } finally {
    definirOcupado(false);
  }
});

filtroStatus.addEventListener("change", renderizarTarefas);
filtroResponsavel.addEventListener("input", renderizarTarefas);

carregarTarefas();