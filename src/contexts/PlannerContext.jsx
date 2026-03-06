import { createContext, useContext, useState, useEffect } from 'react';
import recipesData from '../data/recipes.json';
import { v4 as uuidv4 } from 'uuid';

const PlannerContext = createContext();

export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error('usePlanner must be used within a PlannerProvider');
  }
  return context;
};

// Initial empty week structure
const initialWeek = {
  Segunda: { almoço: null, jantar: null },
  Terça: { almoço: null, jantar: null },
  Quarta: { almoço: null, jantar: null },
  Quinta: { almoço: null, jantar: null },
  Sexta: { almoço: null, jantar: null },
  Sábado: { almoço: null, jantar: null },
  Domingo: { almoço: null, jantar: null },
};

export const PlannerProvider = ({ children }) => {
  const [recipes] = useState(recipesData);
  const [planner, setPlanner] = useState(() => {
    const saved = localStorage.getItem('food-planner-week');
    return saved ? JSON.parse(saved) : initialWeek;
  });
  const [shoppingList, setShoppingList] = useState([]);
  const [viewingRecipe, setViewingRecipe] = useState(null);

  // Save planner changes to localStorage
  useEffect(() => {
    localStorage.setItem('food-planner-week', JSON.stringify(planner));
    generateShoppingList();
  }, [planner]);

  const setMeal = (day, mealType, recipeId) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    setPlanner(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [mealType]: recipe
      }
    }));
  };

  const removeMeal = (day, mealType) => {
    setPlanner(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [mealType]: null
      }
    }));
  };

  const clearWeek = () => {
    setPlanner(initialWeek);
  };

  const generateShoppingList = () => {
    const allIngredients = [];

    // Collect all ingredients from the planned meals
    Object.values(planner).forEach(day => {
      if (day.almoço && day.almoço.ingredients) {
        day.almoço.ingredients.forEach(ing => allIngredients.push(ing));
      }
      if (day.jantar && day.jantar.ingredients) {
        day.jantar.ingredients.forEach(ing => allIngredients.push(ing));
      }
    });

    // In a real advanced app this would use NLP to group "2 onions" and "1 onion" into "3 onions".
    // For this prompt, we create an array of unique-looking strings and give them a checked state.
    const uniqueIngredientsMap = new Map();

    allIngredients.forEach(ingText => {
      // Normalize string for simple exact match deduplication (lowercased without leading/trailing spaces)
      const normalizedIng = ingText.toLowerCase().trim();

      if (!uniqueIngredientsMap.has(normalizedIng)) {
        uniqueIngredientsMap.set(normalizedIng, {
          id: uuidv4(),
          originalText: ingText,
          checked: false
        });
      }
    });

    // Check with the current state to preserve checked logic if they matched
    // (This is a simplified approach. If an ingredient is removed from planner, it disappears).
    setShoppingList(prevList => {
      const newList = Array.from(uniqueIngredientsMap.values());
      return newList.map(item => {
        const existingItem = prevList.find(p => p.originalText.toLowerCase().trim() === item.originalText.toLowerCase().trim());
        return existingItem ? existingItem : item;
      });
    });
  };

  const generateBalancedWeek = () => {
    const quotas = {
      "Peixe e Conservas": 4,
      "Base de Leguminosas / Vegetariano": 4,
      "Carnes Brancas": 3,
      "Massas e Arroz": 2,
      "Carnes Vermelhas": 1
    };

    const recipesByCategory = {
      "Peixe e Conservas": recipes.filter(r => r.category === "Peixe e Conservas"),
      "Base de Leguminosas / Vegetariano": recipes.filter(r => r.category === "Base de Leguminosas / Vegetariano"),
      "Carnes Brancas": recipes.filter(r => r.category === "Carnes Brancas"),
      "Massas e Arroz": recipes.filter(r => r.category === "Massas e Arroz"),
      "Carnes Vermelhas": recipes.filter(r => r.category === "Carnes Vermelhas")
    };

    let selectedRecipes = [];

    Object.keys(quotas).forEach(cat => {
      let catRecipes = [...recipesByCategory[cat]];
      // Fisher-Yates shuffle for true randomness
      for (let i = catRecipes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [catRecipes[i], catRecipes[j]] = [catRecipes[j], catRecipes[i]];
      }

      for (let i = 0; i < quotas[cat]; i++) {
        if (catRecipes.length === 0) break;
        selectedRecipes.push(catRecipes.pop());
      }
    });

    // Distribute nicely: By sorting by category, we deal them out across 14 slots (lunch/dinner) 
    // minimizing the chance of getting the same category on the same day.
    selectedRecipes.sort((a, b) => a.category.localeCompare(b.category));

    const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const weekPlan = {};
    days.forEach(d => weekPlan[d] = { almoço: null, jantar: null });

    selectedRecipes.forEach((recipe, index) => {
      const day = days[index % 7];
      const meal = index < 7 ? "almoço" : "jantar";
      weekPlan[day][meal] = recipe;
    });

    setPlanner(weekPlan);
  };

  const viewRecipe = (recipe) => {
    setViewingRecipe(recipe);
  };

  const closeRecipe = () => {
    setViewingRecipe(null);
  };

  const toggleIngredient = (id) => {
    setShoppingList(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const value = {
    recipes,
    planner,
    shoppingList,
    setMeal,
    removeMeal,
    clearWeek,
    generateBalancedWeek,
    toggleIngredient,
    viewingRecipe,
    viewRecipe,
    closeRecipe
  };

  return (
    <PlannerContext.Provider value={value}>
      {children}
    </PlannerContext.Provider>
  );
};
