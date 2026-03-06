import { useState } from 'react';
import { usePlanner } from '../contexts/PlannerContext';
import { FiSearch, FiClock, FiHeart, FiMoreHorizontal } from 'react-icons/fi';

const CATEGORIES = ["Todas", "Peixe e Conservas", "Base de Leguminosas / Vegetariano", "Carnes Brancas", "Massas e Arroz", "Carnes Vermelhas"];

export default function RecipeExplorer() {
    const { recipes, viewRecipe } = usePlanner();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [selectedRecipe, setSelectedRecipe] = useState(null); // For drag logic context
    const [draggedRecipeId, setDraggedRecipeId] = useState(null);

    const filteredRecipes = recipes.filter(r => {
        const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.origin.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === "Todas" || r.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const handleDragStart = (e, recipe) => {
        // We pass ID via datatransfer and also keep local state for styles
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

                <select
                    className="search-input"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{ paddingLeft: '12px' }}
                >
                    {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
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
                            <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: 'var(--accent-primary)', lineHeight: 1.3 }}>
                                {recipe.title}
                            </h3>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                <span style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                    {recipe.origin}
                                </span>
                                <span style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <FiClock /> {recipe.time}
                                </span>
                            </div>

                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                <span style={{ fontWeight: 600 }}>Bebé:</span> {recipe.baby_adaptation}
                            </p>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {recipe.dynamics.map((dyn, i) => (
                                    <span key={i} style={{ fontSize: '0.65rem', border: '1px solid var(--border-strong)', padding: '2px 6px', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                        {dyn}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </aside>
    );
}
