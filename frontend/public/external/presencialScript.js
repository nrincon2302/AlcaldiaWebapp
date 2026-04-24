document.addEventListener('DOMContentLoaded', function () {
  const table = document.getElementById('tablaPuntos');
  if (!table) return;

  const tbody = table.tBodies[0];
  const rows  = Array.from(tbody.rows);

  const searchInput = document.getElementById('searchInputPuntos');
  const entidadSel  = document.getElementById('filterEntidadPuntos');
  const puntoSel    = document.getElementById('filterPunto');

  const entidadesSet = new Set();
  const puntosSet    = new Set();

  const entidadPuntosMap  = new Map(); // entidad -> Set(puntos)
  const puntoEntidadesMap = new Map(); // punto   -> Set(entidades)

  // 🔹 Función para ignorar tildes y mayúsculas
  function normalizar(str) {
    return str
      .normalize('NFD')                 // separa letras y tildes
      .replace(/[\u0300-\u036f]/g, '')  // elimina las tildes
      .toLowerCase();                   // pasa a minúsculas
  }

  // Recorremos filas: llenamos sets / mapas y convertimos URL a enlace
  rows.forEach(row => {
    const entidad   = row.cells[0].textContent.trim();
    const punto     = row.cells[1].textContent.trim();
    const linkCell  = row.cells[3];

    entidadesSet.add(entidad);
    puntosSet.add(punto);

    // entidad -> puntos
    if (!entidadPuntosMap.has(entidad)) {
      entidadPuntosMap.set(entidad, new Set());
    }
    entidadPuntosMap.get(entidad).add(punto);

    // punto -> entidades
    if (!puntoEntidadesMap.has(punto)) {
      puntoEntidadesMap.set(punto, new Set());
    }
    puntoEntidadesMap.get(punto).add(entidad);

    // Convertir URL en enlace
    let existingLink = linkCell.querySelector('a');
    if (existingLink) {
      // Si ya hay un <a>, mejorarlo
      existingLink.textContent = 'Responder encuesta';
      existingLink.target = '_blank';
      existingLink.rel = 'noopener';
    } else {
      // Si no hay <a>, extraer URL y crear enlace
      const url = linkCell.textContent.trim();
      if (url && (url.startsWith('http') || url.startsWith('/'))) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Responder encuesta';
        linkCell.innerHTML = '';
        linkCell.appendChild(a);
      }
    }
  });

  const todasEntidades = Array.from(entidadesSet).sort((a, b) => a.localeCompare(b, 'es'));
  const todosPuntos    = Array.from(puntosSet).sort((a, b) => a.localeCompare(b, 'es'));

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

  function rellenarPuntos(lista, seleccionPreferida) {
    const anterior = puntoSel.value;
    puntoSel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'Todos los puntos';
    puntoSel.appendChild(optAll);

    lista.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      puntoSel.appendChild(opt);
    });

    const preferida = seleccionPreferida || anterior;
    if (preferida && lista.includes(preferida)) {
      puntoSel.value = preferida;
    } else {
      puntoSel.value = '';
    }
  }

  // Carga inicial
  rellenarEntidades(todasEntidades);
  rellenarPuntos(todosPuntos);

  // 🔍 Aplicar filtros combinados (texto + entidad + punto)
  function aplicarFiltros() {
    const texto     = normalizar(searchInput.value.trim());
    const entSel    = entidadSel.value;
    const puntoSelV = puntoSel.value;

    rows.forEach(row => {
      const entidad   = row.cells[0].textContent.trim();
      const punto     = row.cells[1].textContent.trim();
      const direccion = row.cells[2].textContent.trim();

      // Texto unificado de la fila, normalizado (sin tildes)
      const textoFila = normalizar(entidad + ' ' + punto + ' ' + direccion);

      const coincideEntidad = !entSel    || entidad === entSel;
      const coincidePunto   = !puntoSelV || punto   === puntoSelV;
      const coincideTexto   = !texto     || textoFila.includes(texto);

      if (coincideEntidad && coincidePunto && coincideTexto) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  // ENTIDAD → restringe puntos
  entidadSel.addEventListener('change', function () {
    const entSelActual = entidadSel.value;
    let puntosValidos;

    if (!entSelActual) {
      puntosValidos = todosPuntos;
    } else {
      puntosValidos = Array.from(entidadPuntosMap.get(entSelActual) || []);
      puntosValidos.sort((a, b) => a.localeCompare(b, 'es'));
    }

    rellenarPuntos(puntosValidos);
    aplicarFiltros();
  });

  // PUNTO → restringe entidades
  puntoSel.addEventListener('change', function () {
    const puntoSelActual = puntoSel.value;
    let entidadesValidas;

    if (!puntoSelActual) {
      entidadesValidas = todasEntidades;
    } else {
      entidadesValidas = Array.from(puntoEntidadesMap.get(puntoSelActual) || []);
      entidadesValidas.sort((a, b) => a.localeCompare(b, 'es'));
    }

    rellenarEntidades(entidadesValidas);
    aplicarFiltros();
  });

  // Buscador en vivo 
  searchInput.addEventListener('input', aplicarFiltros);
});