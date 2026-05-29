export function flattenManches(manches = []) {
  return [...manches]
    .sort((a, b) => a.ordre - b.ordre)
    .flatMap(m =>
      [...(m.mancheQuestions ?? [])]
        .sort((a, b) => a.ordre - b.ordre)
        .map(mq => ({ ...mq.question, mancheNom: m.nom, mancheOrdre: m.ordre }))
    )
}
