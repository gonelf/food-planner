import { createContext, useContext, useState, useEffect } from 'react';
import salmonRecipes from '../data/recipes.json';
import frangoRecipes from '../data/recipes-frango.json';
import { v4 as uuidv4 } from 'uuid';
import { buildShoppingList } from '../utils/ingredientParser';

const recipesData = [...salmonRecipes, ...frangoRecipes];

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

    const ingToString = (ing) => {
      if (ing.quantity === 'q.b.') return `q.b. ${ing.name}`;
      return [ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ');
    };

    // Collect all ingredients from the planned meals
    Object.values(planner).forEach(day => {
      if (day.almoço && day.almoço.ingredients) {
        day.almoço.ingredients.forEach(ing => allIngredients.push(ingToString(ing)));
      }
      if (day.jantar && day.jantar.ingredients) {
        day.jantar.ingredients.forEach(ing => allIngredients.push(ingToString(ing)));
      }
    });

    // Parse, normalise, aggregate and format into buyable shopping items
    const parsedItems = buildShoppingList(allIngredients);

    setShoppingList(prevList => {
      return parsedItems.map(item => {
        // Preserve checked state by matching on normalised ingredient name
        const existing = prevList.find(p => p.name === item.name);
        return {
          id: existing ? existing.id : uuidv4(),
          name: item.name,
          displayText: item.displayText,
          checked: existing ? existing.checked : false,
        };
      });
    });
  };

  const generateBalancedWeek = () => {
    // Fisher-Yates shuffle
    const shuffled = [...recipes];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, 14);

    const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const weekPlan = {};
    days.forEach(d => weekPlan[d] = { almoço: null, jantar: null });

    selected.forEach((recipe, index) => {
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
