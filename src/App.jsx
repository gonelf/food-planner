import RecipeExplorer from './components/RecipeExplorer';
import WeeklyPlanner from './components/WeeklyPlanner';
import ShoppingList from './components/ShoppingList';
import RecipeModal from './components/RecipeModal';

function App() {
    return (
        <div className="app-layout">
            {/* 1. Left Panel: Recipe Explorer */}
            <RecipeExplorer />

            {/* 2. Main Center Area: Weekly Drag & Drop Planner */}
            <WeeklyPlanner />

            {/* 3. Right Panel: Dynamic Shopping List */}
            <ShoppingList />

            {/* 4. Global Recipe Modal */}
            <RecipeModal />
        </div>
    );
}

export default App;
