document.addEventListener('DOMContentLoaded', function () {
  const table = document.getElementById('tablaEncuestas');
  if (!table) return;

  const tbody  = table.tBodies[0];
  const rows   = Array.from(tbody.rows);

  const searchInput = document.getElementById('searchInput');
  const entidadSel  = document.getElementById('filterEntidad');
  const sectorSel   = document.getElementById('filterSector');
  const noResults   = document.getElementById('noResults'); // opcional

  const entidadesSet = new Set();
  const sectoresSet  = new Set();

  // Mapas jerárquicos
  const entidadSectoresMap  = new Map(); // entidad -> Set(sectores)
  const sectorEntidadesMap  = new Map(); // sector  -> Set(entidades)

  // 🔹 Función para ignorar tildes y mayúsculas
  function normalizar(str) {
    return str
      .normalize('NFD')                 // separa letras y tildes
      .replace(/[\u0300-\u036f]/g, '')  // elimina las tildes
      .toLowerCase();                   // pasa a minúsculas
  }

  // Recorremos filas: llenamos sets / mapas y convertimos URL a enlace
  rows.forEach(row => {
    const entidad = row.cells[0].textContent.trim();
    const sector  = row.cells[1].textContent.trim();

    entidadesSet.add(entidad);
    sectoresSet.add(sector);

    if (!entidadSectoresMap.has(entidad)) {
      entidadSectoresMap.set(entidad, new Set());
    }
    entidadSectoresMap.get(entidad).add(sector);

    if (!sectorEntidadesMap.has(sector)) {
      sectorEntidadesMap.set(sector, new Set());
    }
    sectorEntidadesMap.get(sector).add(entidad);

    // Columna 2: Link de encuesta -> <a>
    const linkCell = row.cells[2];
    const url = linkCell.textContent.trim();
    if (url && !linkCell.querySelector('a')) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Responder encuesta';
      linkCell.textContent = '';
      linkCell.appendChild(a);
    }
  });

  const todasEntidades = Array.from(entidadesSet).sort((a, b) => a.localeCompare(b, 'es'));
  const todosSectores  = Array.from(sectoresSet).sort((a, b) => a.localeCompare(b, 'es'));

  // Helpers para rellenar selects
  function rellenarEntidades(lista, seleccionPreferida) {
    const anterior = entidadSel.value;
    entidadSel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'Todas las entidades';
    entidadSel.appendChild(optAll);

    lista.forEach(ent => {
      const opt = document.createElement('option');
      opt.value = ent;
      opt.textContent = ent;
      entidadSel.appendChild(opt);
    });

    const preferida = seleccionPreferida || anterior;
    if (preferida && lista.includes(preferida)) {
      entidadSel.value = preferida;
    } else {
      entidadSel.value = '';
    }
  }

  function rellenarSectores(lista, seleccionPreferida) {
    const anterior = sectorSel.value;
    sectorSel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'Todos los sectores';
    sectorSel.appendChild(optAll);

    lista.forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec;
      opt.textContent = sec;
      sectorSel.appendChild(opt);
    });

    const preferida = seleccionPreferida || anterior;
    if (preferida && lista.includes(preferida)) {
      sectorSel.value = preferida;
    } else {
      sectorSel.value = '';
    }
  }

  // Carga inicial
  rellenarEntidades(todasEntidades);
  rellenarSectores(todosSectores);

  // Aplicar filtros combinados
  function aplicarFiltros() {
    const texto  = normalizar(searchInput.value.trim());
    const entSel = entidadSel.value;
    const secSel = sectorSel.value;

    let hayResultados = false;

    rows.forEach(row => {
      const entidad = row.cells[0].textContent.trim();
      const sector  = row.cells[1].textContent.trim();

      // 🔹 Texto de la fila normalizado (sin tildes)
      const textoFila = normalizar(entidad + ' ' + sector);

      const coincideEntidad = !entSel || entidad === entSel;
      const coincideSector  = !secSel || sector  === secSel;
      const coincideTexto   = !texto || textoFila.includes(texto);

      if (coincideEntidad && coincideSector && coincideTexto) {
        row.style.display = '';
        hayResultados = true;
      } else {
        row.style.display = 'none';
      }
    });

    if (noResults) {
      noResults.style.display = hayResultados ? 'none' : 'block';
    }
  }

  // ENTIDAD → restringe sectores
  entidadSel.addEventListener('change', function () {
    const entSelActual = entidadSel.value;
    let sectoresValidos;

    if (!entSelActual) {
      sectoresValidos = todosSectores;
    } else {
      sectoresValidos = Array.from(entidadSectoresMap.get(entSelActual) || []);
      sectoresValidos.sort((a, b) => a.localeCompare(b, 'es'));
    }

    rellenarSectores(sectoresValidos);
    aplicarFiltros();
  });

  // SECTOR → restringe entidades
  sectorSel.addEventListener('change', function () {
    const secSelActual = sectorSel.value;
    let entidadesValidas;

    if (!secSelActual) {
      entidadesValidas = todasEntidades;
    } else {
      entidadesValidas = Array.from(sectorEntidadesMap.get(secSelActual) || []);
      entidadesValidas.sort((a, b) => a.localeCompare(b, 'es'));
    }

    rellenarEntidades(entidadesValidas);
    aplicarFiltros();
  });

  // Buscador
  searchInput.addEventListener('input', aplicarFiltros);
});