export function mergeLeadsPage(leadsCarregados, novaPagina) {
  const telefonesExistentes = new Set(leadsCarregados.map((lead) => lead.phone));
  const leadsNovos = novaPagina.filter((lead) => !telefonesExistentes.has(lead.phone));
  return [...leadsCarregados, ...leadsNovos];
}

export function atualizarPrimeiraPagina(leadsCarregados, paginaAtualizada) {
  const telefonesAtualizados = new Set(paginaAtualizada.map((lead) => lead.phone));
  const restante = leadsCarregados.filter((lead) => !telefonesAtualizados.has(lead.phone));
  return [...paginaAtualizada, ...restante];
}
