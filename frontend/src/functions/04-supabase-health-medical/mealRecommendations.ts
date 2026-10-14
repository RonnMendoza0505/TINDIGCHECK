/*
    TINDIGCHECK! 2.0 — Meal Recommendations (Phase 5)
    General meal examples only. No nutritional assessment or treatment.
    These recipes are NOT guaranteed allergen-free: staff must verify
    ingredients, packaging, substitutions and cross-contact.
*/

export type MealFocus = "balanced" | "protein" | "vegetables";

export type MajorAllergen =
    | "milk"
    | "egg"
    | "peanut"
    | "tree nuts"
    | "soy"
    | "wheat"
    | "fish"
    | "shellfish"
    | "sesame";

export type MealIdea = {
    id: string;
    title: string;
    description: string;
    ingredients: string[];
    allergens: MajorAllergen[];
    focuses: MealFocus[];
};

/*
    Recipe ingredient lists are examples. Do not assume commercial,
    canteen or home-prepared versions have identical ingredients.
*/
export const MEAL_IDEAS: MealIdea[] = [
    {
        id: "tinola",
        title: "Chicken tinola with rice",
        description: "Chicken, green papaya and malunggay in a ginger broth, with rice.",
        ingredients: ["chicken", "green papaya", "malunggay", "ginger", "rice", "water", "salt"],
        allergens: [],
        focuses: ["balanced", "protein", "vegetables"]
    },
    {
        id: "nilaga",
        title: "Pork nilaga with rice",
        description: "Pork and mixed vegetables simmered in broth, served with rice.",
        ingredients: ["pork", "potato", "cabbage", "carrot", "rice", "water", "salt"],
        allergens: [],
        focuses: ["balanced", "protein", "vegetables"]
    },
    {
        id: "munggo",
        title: "Ginisang munggo and malunggay",
        description: "Mung beans with leafy greens and rice; no shrimp paste in this example recipe.",
        ingredients: ["mung beans", "malunggay", "garlic", "onion", "rice", "water"],
        allergens: [],
        focuses: ["balanced", "protein", "vegetables"]
    },
    {
        id: "egg-rice",
        title: "Egg, tomato and rice",
        description: "Cooked scrambled egg with fresh tomato and rice.",
        ingredients: ["egg", "tomato", "rice", "cooking oil"],
        allergens: ["egg"],
        focuses: ["balanced", "protein"]
    },
    {
        id: "tilapia",
        title: "Grilled tilapia and vegetables",
        description: "Tilapia with rice and steamed kangkong.",
        ingredients: ["tilapia", "rice", "kangkong", "calamansi"],
        allergens: ["fish"],
        focuses: ["balanced", "protein", "vegetables"]
    },
    {
        id: "tofu",
        title: "Tofu and vegetable rice bowl",
        description: "Tofu with carrots and pechay over rice, without commercial sauces.",
        ingredients: ["tofu (soy)", "carrot", "pechay", "rice", "garlic"],
        allergens: ["soy"],
        focuses: ["balanced", "protein", "vegetables"]
    },
    {
        id: "adobo",
        title: "Chicken adobo with rice",
        description: "Chicken adobo prepared with regular soy sauce and rice.",
        ingredients: ["chicken", "soy sauce (soy, wheat)", "vinegar", "garlic", "rice"],
        allergens: ["soy", "wheat"],
        focuses: ["balanced", "protein"]
    },
    {
        id: "lugaw",
        title: "Chicken lugaw with carrots",
        description: "Rice porridge with chicken, ginger and carrots.",
        ingredients: ["rice", "chicken", "ginger", "carrot", "water", "salt"],
        allergens: [],
        focuses: ["balanced", "vegetables"]
    },
    {
        id: "banana-oats",
        title: "Banana oatmeal with milk",
        description: "Cooked oats with banana and milk; verify oats for wheat cross-contact.",
        ingredients: ["oats", "banana", "milk"],
        allergens: ["milk", "wheat"],
        focuses: ["balanced"]
    }
];

/*
    Only a limited list of major allergens is recognized. If a learner
    has an allergy outside this list, the UI blocks suggestions rather
    than incorrectly asserting that any recipe is safe.
*/
const ALLERGEN_ALIASES: Record<string, MajorAllergen> = {
    milk: "milk", dairy: "milk",
    egg: "egg", eggs: "egg",
    peanut: "peanut", peanuts: "peanut", mani: "peanut",
    "tree nut": "tree nuts", "tree nuts": "tree nuts",
    almond: "tree nuts", almonds: "tree nuts", cashew: "tree nuts", cashews: "tree nuts",
    walnut: "tree nuts", walnuts: "tree nuts", pistachio: "tree nuts", pistachios: "tree nuts",
    soy: "soy", soya: "soy", soybean: "soy", soybeans: "soy",
    wheat: "wheat", trigo: "wheat",
    fish: "fish", isda: "fish",
    shellfish: "shellfish", shrimp: "shellfish", prawn: "shellfish", crab: "shellfish",
    hipon: "shellfish", alimango: "shellfish",
    sesame: "sesame", linga: "sesame"
};

export function parseAllergyReview(raw: string): {
    allergens: MajorAllergen[];
    unsupported: string[];
} {
    const allergens = new Set<MajorAllergen>();
    const unsupported: string[] = [];
    for (const item of raw.split(/[,;\n]+/)) {
        const normalized = item.trim().toLowerCase().replace(/\s+/g, " ");
        if (!normalized) continue;
        const known = ALLERGEN_ALIASES[normalized];
        if (known) allergens.add(known);
        else if (!unsupported.includes(normalized)) unsupported.push(normalized);
    }
    return { allergens: [...allergens], unsupported };
}

export function getMealIdeas(
    focus: MealFocus,
    allergens: MajorAllergen[]
): MealIdea[] {
    const blocked = new Set(allergens);
    return MEAL_IDEAS.filter(idea =>
        idea.focuses.includes(focus) &&
        !idea.allergens.some(allergen => blocked.has(allergen))
    );
}
