document.addEventListener('DOMContentLoaded', function () {
  const table = document.getElementById('tablaTramites');
  if (!table) return;

  const tbody = table.tBodies[0];
  const rows  = Array.from(tbody.rows);

  const searchInput = document.getElementById('searchInputTram');
  const entidadSel  = document.getElementById('filterEntidadTram');
  const sectorSel   = document.getElementById('filterSectorTram');

  const entidadesSet = new Set();
  const sectoresSet  = new Set();

  // sector -> entidades
  const sectorEntidadesMap = new Map();
  // entidad -> sector
  const entidadSectorMap   = new Map();

  // 🔹 Función para ignorar tildes y mayúsculas
  function normalizar(str) {
    return str
      .normalize('NFD')                 // separa letra y tilde
      .replace(/[\u0300-\u036f]/g, '')  // elimina las tildes
      .toLowerCase();                   // a minúsculas
  }

  // Recorremos filas: llenamos sets/mapas y convertimos URL en enlace
  rows.forEach(row => {
    const entidad   = row.cells[0].textContent.trim();
    const sector    = row.cells[1].textContent.trim();
    const linkCell  = row.cells[4];

    entidadesSet.add(entidad);
    sectoresSet.add(sector);

    // Mapas de relación
    entidadSectorMap.set(entidad, sector);

    if (!sectorEntidadesMap.has(sector)) {
      sectorEntidadesMap.set(sector, new Set());
    }
    sectorEntidadesMap.get(sector).add(entidad);

    // Link de encuesta -> <a>
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

    const preferido = seleccionPreferida || anterior;
    if (preferido && lista.includes(preferido)) {
      sectorSel.value = preferido;
    } else {
      sectorSel.value = '';
    }
  }

  // Carga inicial
  rellenarEntidades(todasEntidades);
  rellenarSectores(todosSectores);

  // 🔍 Aplicar filtros combinados (texto + entidad + sector)
  function aplicarFiltros() {
    const texto   = normalizar(searchInput.value.trim());
    const entSel  = entidadSel.value;
    const secSel  = sectorSel.value;

    rows.forEach(row => {
      const entidad   = row.cells[0].textContent.trim();
      const sector    = row.cells[1].textContent.trim();
      const idTram    = row.cells[2].textContent.trim();
      const tramite   = row.cells[3].textContent.trim();

      const textoFila = normalizar(
        entidad + ' ' + sector + ' ' + idTram + ' ' + tramite
      );

      const coincideEntidad = !entSel || entidad === entSel;
      const coincideSector  = !secSel || sector  === secSel;
      const coincideTexto   = !texto || textoFila.includes(texto);

      if (coincideEntidad && coincideSector && coincideTexto) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  // ENTIDAD → restringe SECTORES
  entidadSel.addEventListener('change', function () {
    const entSelActual = entidadSel.value;
    let sectoresValidos;

    if (!entSelActual) {
      // Sin entidad -> todos los sectores
      sectoresValidos = todosSectores;
      rellenarSectores(sectoresValidos);
    } else {
      const sectorDeEntidad = entidadSectorMap.get(entSelActual);
      sectoresValidos = sectorDeEntidad ? [sectorDeEntidad] : [];
      rellenarSectores(sectoresValidos, sectorDeEntidad);
    }

    aplicarFiltros();
  });

  // SECTOR → restringe ENTIDADES
  sectorSel.addEventListener('change', function () {
    const secSelActual = sectorSel.value;
    let entidadesValidas;

    if (!secSelActual) {
      // Sin sector -> todas las entidades
      entidadesValidas = todasEntidades;
    } else {
      entidadesValidas = Array.from(sectorEntidadesMap.get(secSelActual) || []);
      entidadesValidas.sort((a, b) => a.localeCompare(b, 'es'));
    }

    rellenarEntidades(entidadesValidas);
    aplicarFiltros();
  });

  // Buscador en vivo 
  searchInput.addEventListener('input', aplicarFiltros);
});