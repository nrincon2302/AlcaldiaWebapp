const params = new URLSearchParams(window.location.search);
const SURVEY_BASE_URL = params.get('baseUrl') || '';

document.addEventListener('DOMContentLoaded', function () {
  // Buscar en cualquiera de las tres tablas (presencial, chat, portal)
  const rows = document.querySelectorAll('#tablaPuntos tbody tr, #tablaEncuestas tbody tr, #tablaTramites tbody tr');

  rows.forEach(row => {
    const lastCell = row.lastElementChild;
    const paramsPart = lastCell.textContent.trim();

    if (SURVEY_BASE_URL && paramsPart) {
      lastCell.textContent = SURVEY_BASE_URL + paramsPart;
    }
  });
});