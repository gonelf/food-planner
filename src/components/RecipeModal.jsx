import { useState } from 'react';
import { usePlanner } from '../contexts/PlannerContext';
import { FiX, FiTag, FiFileText, FiPlus, FiCheck } from 'react-icons/fi';

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function RecipeModal() {
    const { viewingRecipe, closeRecipe, setMeal } = usePlanner();
    const [selectedDay, setSelectedDay] = useState('Segunda');
    const [selectedMeal, setSelectedMeal] = useState('almoço');
    const [added, setAdded] = useState(false);

    if (!viewingRecipe) return null;

    const handleAddToPlan = () => {
        setMeal(selectedDay, selectedMeal, viewingRecipe.id);
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
    };

    return (
        <div
            className="modal-overlay"
            onClick={closeRecipe}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px'
            }}
        >
            <div
                className="modal-content animate-fade-in"
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-xl)',
                    width: '100%',
                    maxWidth: '600px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-float)',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            {viewingRecipe.title}
                        </h2>
                    </div>
                    <button
                        className="btn-icon"
                        onClick={closeRecipe}
                        style={{ flexShrink: 0, background: 'var(--bg-tertiary)' }}
                    >
                        <FiX size={20} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', WebkitOverflowScrolling: 'touch' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                        {/* Ingredients */}
                        <div>
                            <h4 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiTag /> Ingredientes
                            </h4>
                            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                {viewingRecipe.ingredients.map((ing, idx) => (
                                    <li key={idx} style={{ lineHeight: 1.4 }}>{ing}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Preparation */}
                        <div>
                            <h4 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiFileText /> Preparação
                            </h4>
                            <ol style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                {viewingRecipe.preparation.map((step, idx) => (
                                    <li key={idx} style={{ lineHeight: 1.5, paddingLeft: '8px', borderBottom: '1px solid var(--bg-tertiary)', paddingBottom: '12px' }}>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>

                    {/* Add to Plan */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Adicionar ao Planeamento
                        </h4>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                                className="search-input"
                                value={selectedDay}
                                onChange={e => setSelectedDay(e.target.value)}
                                style={{ flex: '1', minWidth: '120px', paddingLeft: '12px' }}
                            >
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select
                                className="search-input"
                                value={selectedMeal}
                                onChange={e => setSelectedMeal(e.target.value)}
                                style={{ flex: '1', minWidth: '100px', paddingLeft: '12px' }}
                            >
                                <option value="almoço">Almoço</option>
                                <option value="jantar">Jantar</option>
                            </select>
                            <button
                                className="btn-primary"
                                onClick={handleAddToPlan}
                                style={added ? { background: 'var(--accent-success)' } : {}}
                            >
                                {added ? <><FiCheck /> Adicionado!</> : <><FiPlus /> Adicionar</>}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
