import { useState } from 'react';
import RecipeExplorer from './components/RecipeExplorer';
import WeeklyPlanner from './components/WeeklyPlanner';
import ShoppingList from './components/ShoppingList';
import RecipeModal from './components/RecipeModal';
import { FiSearch, FiCalendar, FiShoppingCart } from 'react-icons/fi';

function App() {
    const [activeTab, setActiveTab] = useState('planner');

    return (
        <div className={`app-layout tab-${activeTab}`}>
            {/* 1. Left Panel: Recipe Explorer */}
            <RecipeExplorer />

            {/* 2. Main Center Area: Weekly Drag & Drop Planner */}
            <WeeklyPlanner />

            {/* 3. Right Panel: Dynamic Shopping List */}
            <ShoppingList />

            {/* 4. Global Recipe Modal */}
            <RecipeModal />

            {/* 5. Mobile Bottom Tab Navigation */}
            <nav className="mobile-bottom-nav">
                <button
                    className={`mobile-tab-btn ${activeTab === 'recipes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recipes')}
                >
                    <FiSearch size={22} />
                    Receitas
                </button>
                <button
                    className={`mobile-tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
                    onClick={() => setActiveTab('planner')}
                >
                    <FiCalendar size={22} />
                    Planeamento
                </button>
                <button
                    className={`mobile-tab-btn ${activeTab === 'shopping' ? 'active' : ''}`}
                    onClick={() => setActiveTab('shopping')}
                >
                    <FiShoppingCart size={22} />
                    Compras
                </button>
            </nav>
        </div>
    );
}

export default App;
