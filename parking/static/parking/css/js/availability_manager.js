// Controle da interface e coleta de dados para a disponibilidade das vagas.

const diasSemana = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo"
];

export function setupAvailabilityFields() {
  const diasDisponibilidade = document.getElementById("diasDisponibilidade");

  diasSemana.forEach((dia, index) => {
    const div = document.createElement("div");
    div.className = "flex items-center";

    div.innerHTML = `
      <input type="checkbox" id="dia-${index}" class="mr-2" data-dia="${dia}">
      <label for="dia-${index}" class="w-32">${dia}</label>
      <input type="time" class="ml-2 border border-gray-300 rounded p-1 hora-inicio" disabled>
      <span class="mx-1">às</span>
      <input type="time" class="border border-gray-300 rounded p-1 hora-fim" disabled>

      <select class="ml-4 border border-gray-300 rounded p-1 qtd-vagas w-20" data-dia="..." >
        <option value="0">Qtde</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
    `;

    diasDisponibilidade.appendChild(div);
  });

  // Habilita/desabilita os campos de horário
  diasDisponibilidade.addEventListener("change", (e) => {
    if (e.target.matches("input[type='checkbox']")) {
      const container = e.target.closest(".flex");
      const enabled = e.target.checked;
      container.querySelector(".hora-inicio").disabled = !enabled;
      container.querySelector(".hora-fim").disabled = !enabled;
      container.querySelector(".qtd-vagas").disabled = !enabled;
    }
  });
}

export function coletarDisponibilidades() {
  const disponibilidades = [];

  diasSemana.forEach((dia, index) => {
    const checkbox = document.getElementById(`dia-${index}`);
    if (checkbox.checked) {
      const container = checkbox.closest(".flex");
      const horaInicio = container.querySelector(".hora-inicio").value;
      const horaFim = container.querySelector(".hora-fim").value;
      const qtdVagas = container.querySelector(".qtd-vagas").value;

      disponibilidades.push({
        day: checkbox.dataset.dia, // Usando 'day' para o nome do campo
        start_time: horaInicio, // Usando 'start_time'
        end_time: horaFim, // Usando 'end_time'
        quantity: parseInt(qtdVagas)
      });
    }
  });

  return disponibilidades;
}

export function formatarTipoVaga(tipo) {
  const tipos = {
    rua_coberta: "Rua (Coberta)",
    rua_descoberta: "Rua (Descoberta)",
    garagem: "Garagem",
    predio_coberta: "Prédio (Coberta)",
    predio_descoberta: "Prédio (Descoberta)",
  };
  return tipos[tipo] || "Tipo desconhecido";
}