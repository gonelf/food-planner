import { usePlanner } from '../contexts/PlannerContext';
import { FiX, FiClock, FiHeart, FiTag, FiFileText } from 'react-icons/fi';

export default function RecipeModal() {
    const { viewingRecipe, closeRecipe } = usePlanner();

    if (!viewingRecipe) return null;

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
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

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
                    <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginRight: '8px' }}>Dinâmicas:</span>
                        {viewingRecipe.dynamics.map((dyn, idx) => (
                            <span key={idx} style={{ fontSize: '0.75rem', background: '#f1f3f5', padding: '4px 10px', borderRadius: '12px', color: '#495057' }}>
                                {dyn}
                            </span>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
}
