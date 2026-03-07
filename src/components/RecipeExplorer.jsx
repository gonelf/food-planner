import { useState } from 'react';
import { usePlanner } from '../contexts/PlannerContext';
import { FiSearch } from 'react-icons/fi';

export default function RecipeExplorer() {
    const { recipes, viewRecipe } = usePlanner();
    const [searchTerm, setSearchTerm] = useState('');
    const [draggedRecipeId, setDraggedRecipeId] = useState(null);

    const filteredRecipes = recipes.filter(r =>
        r.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDragStart = (e, recipe) => {
        e.dataTransfer.setData('recipeId', recipe.id.toString());
        e.dataTransfer.effectAllowed = 'copy';
        setDraggedRecipeId(recipe.id);
    };

    const handleDragEnd = () => {
        setDraggedRecipeId(null);
    };

    return (
        <aside className="app-sidebar">
            <div className="panel-header">
                <h2 className="panel-title heading-gradient">Receitas ({filteredRecipes.length})</h2>

                <div className="search-input-wrapper">
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Pesquisar refeições..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="recipes-list" style={{ overflowY: 'auto', padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredRecipes.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 16px' }}>
                        Nenhuma receita encontrada
                    </div>
                ) : (
                    filteredRecipes.map(recipe => (
                        <div
                            key={recipe.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, recipe)}
                            onDragEnd={handleDragEnd}
                            style={{
                                backgroundColor: 'var(--bg-primary)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-md)',
                                padding: '16px',
                                cursor: 'grab',
                                opacity: draggedRecipeId === recipe.id ? 0.5 : 1,
                                transform: draggedRecipeId === recipe.id ? 'scale(0.98)' : 'scale(1)',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                            }}
                            onClick={() => viewRecipe(recipe)}
                            className="recipe-card"
                        >
                            <h3 style={{ fontSize: '1rem', color: 'var(--accent-primary)', lineHeight: 1.3, marginBottom: '8px' }}>
                                {recipe.title}
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {recipe.ingredients.join(', ')}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </aside>
    );
}
