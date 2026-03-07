import { useState } from 'react';
import { usePlanner } from '../contexts/PlannerContext';
import { FiX, FiClock, FiHeart, FiTag, FiFileText, FiPlus, FiCheck } from 'react-icons/fi';

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
                        <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: '8px' }}>
                            {viewingRecipe.title}
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '4px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FiClock /> {viewingRecipe.time}
                            </span>
                            <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                {viewingRecipe.origin}
                            </span>
                            <span style={{ fontSize: '0.8rem', border: '1px solid var(--accent-primary)', padding: '3px 10px', borderRadius: '4px', color: 'var(--accent-primary)', fontWeight: 500 }}>
                                {viewingRecipe.category}
                            </span>
                        </div>
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

                    {/* Baby Adaptation Highlight */}
                    <div style={{ background: 'var(--accent-primary-light)', padding: '16px', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--accent-primary)' }}>
                        <h4 style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FiHeart /> Adaptação para o Bebé (1 Ano)
                        </h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {viewingRecipe.baby_adaptation}
                        </p>
                    </div>

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

                        {/* Instructions */}
                        <div>
                            <h4 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiFileText /> Preparação
                            </h4>
                            <ol style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                {viewingRecipe.instructions.map((step, idx) => (
                                    <li key={idx} style={{ lineHeight: 1.5, paddingLeft: '8px', borderBottom: '1px solid var(--bg-tertiary)', paddingBottom: '12px' }}>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>

                    {/* Dynamics Labels */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginRight: '8px' }}>Dinâmicas:</span>
                        {viewingRecipe.dynamics.map((dyn, idx) => (
                            <span key={idx} style={{ fontSize: '0.75rem', background: '#f1f3f5', padding: '4px 10px', borderRadius: '12px', color: '#495057' }}>
                                {dyn}
                            </span>
                        ))}
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
