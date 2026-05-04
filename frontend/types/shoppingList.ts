export interface ShoppingListItem {
    id: string;
    ingredient_name: string;
    required_amount: number;
    unit: string;
    in_stock: boolean;
    stock_amount: number;
    checked: boolean;
}

export interface ShoppingList {
    id: string;
    created_at: string;
    source_recipes: string[];
    source_recipe_names: string[];
    items: ShoppingListItem[];
    status: "pending" | "completed";
}

export interface ShoppingListStore {
    shopping_lists: ShoppingList[];
    lastUpdated: number;
}
