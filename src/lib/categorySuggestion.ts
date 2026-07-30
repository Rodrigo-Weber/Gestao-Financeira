import type { Category, Transaction } from "../types";

const conceptTerms: Record<string, string[]> = {
  alimentacao: ["acougue", "alimentacao", "comida", "feira", "ifood", "lanche", "mercado", "padaria", "pizza", "restaurante", "supermercado"],
  casa: ["agua", "aluguel", "casa", "condominio", "energia", "gas", "internet", "luz", "manutencao", "movel"],
  transporte: ["99", "combustivel", "estacionamento", "gasolina", "onibus", "passagem", "posto", "transporte", "uber"],
  lazer: ["bar", "cinema", "jogo", "lazer", "netflix", "show", "spotify", "streaming", "viagem"],
  saude: ["academia", "dentista", "exame", "farmacia", "hospital", "medico", "remedio", "saude"],
  educacao: ["curso", "educacao", "escola", "faculdade", "livro", "mensalidade"],
  compras: ["amazon", "compra", "loja", "mercado livre", "roupa", "shopping", "shopee"],
  beleza: ["barbearia", "beleza", "cabeleireiro", "cosmetico", "salao"],
  pets: ["pet", "petshop", "racao", "veterinario"],
  assinaturas: ["assinatura", "canva", "icloud", "plano", "software", "youtube"],
  salario: ["pagamento", "salario", "salário", "vencimento"],
  renda: ["freela", "freelance", "recebimento", "renda", "servico"],
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const tokens = (value: string) => new Set(normalize(value).split(" ").filter((item) => item.length > 1));

function historicalScore(description: string, categoryId: string, transactions: Transaction[]) {
  const target = normalize(description);
  const targetTokens = tokens(description);
  let best = 0;
  for (const item of transactions) {
    if (item.categoryId !== categoryId) continue;
    const previous = normalize(item.description);
    if (!previous) continue;
    if (previous === target) return 100;
    if (target.includes(previous) || previous.includes(target)) best = Math.max(best, 70);
    const overlap = [...tokens(item.description)].filter((token) => targetTokens.has(token)).length;
    if (overlap) best = Math.max(best, overlap * 18);
  }
  return best;
}

export function suggestCategory(
  description: string,
  kind: Category["kind"],
  categories: Category[],
  transactions: Transaction[] = [],
) {
  const normalizedDescription = normalize(description);
  if (normalizedDescription.length < 2) return undefined;
  const available = categories.filter((category) => category.kind === kind);
  const ranked = available.map((category) => {
    const categoryName = normalize(category.name);
    let score = historicalScore(description, category.id, transactions);
    if (normalizedDescription.includes(categoryName)) score = Math.max(score, 85);
    for (const [concept, terms] of Object.entries(conceptTerms)) {
      const categoryMatchesConcept = categoryName.includes(concept) || terms.some((term) => categoryName.includes(normalize(term)));
      if (!categoryMatchesConcept) continue;
      const matches = terms.filter((term) => normalizedDescription.includes(normalize(term))).length;
      score = Math.max(score, matches * 35);
    }
    return { category, score };
  }).sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  if (!winner || winner.score < 30) return undefined;
  return { id: winner.category.id, name: winner.category.name, confidence: Math.min(1, winner.score / 100) };
}
