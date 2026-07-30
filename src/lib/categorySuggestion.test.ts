import { describe, expect, it } from "vitest";
import type { Category, Transaction } from "../types";
import { suggestCategory } from "./categorySuggestion";

const categories: Category[] = [
  { id: "food", name: "Alimentação", icon: "", color: "#000", kind: "expense" },
  { id: "transport", name: "Transporte", icon: "", color: "#000", kind: "expense" },
  { id: "health", name: "Saúde", icon: "", color: "#000", kind: "expense" },
  { id: "other", name: "Outros", icon: "", color: "#000", kind: "expense" },
];

describe("category suggestion", () => {
  it("infers a category from the transaction title", () => {
    expect(suggestCategory("Compra no supermercado", "expense", categories)?.id).toBe("food");
    expect(suggestCategory("Gasolina no posto", "expense", categories)?.id).toBe("transport");
    expect(suggestCategory("Consulta no dentista", "expense", categories)?.id).toBe("health");
  });

  it("prioritizes the user's matching transaction history", () => {
    const history: Transaction[] = [{
      id: "1", description: "Loja do João", amount: 35, kind: "expense", status: "paid",
      dueDate: "2026-07-01", competenceDate: "2026-07-01", categoryId: "transport", source: "manual",
    }];
    expect(suggestCategory("Loja do João", "expense", categories, history)?.id).toBe("transport");
  });
});
