import { usePlanner } from '../contexts/PlannerContext';
import { FiCheckCircle, FiCircle, FiShoppingCart } from 'react-icons/fi';
import { SHOPPING_CATEGORIES } from '../utils/ingredientParser';

export default function ShoppingList() {
    const { shoppingList, toggleIngredient } = usePlanner();

    const totalItems = shoppingList.length;
    const completedItems = shoppingList.filter(i => i.checked).length;
    const progress = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

    // Group items by category, preserving the canonical category order
    const grouped = SHOPPING_CATEGORIES
        .map(cat => ({
            ...cat,
            items: shoppingList.filter(item => item.category === cat.id),
        }))
        .filter(group => group.items.length > 0);

    return (
        <aside className="app-right-panel glass-panel">
            <div className="panel-header">
                <h2 className="panel-title heading-gradient">
                    <FiShoppingCart /> Compras
                </h2>

                {totalItems > 0 && (
                    <div style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            <span>Progresso</span>
                            <span style={{ fontWeight: 600 }}>{completedItems} de {totalItems}</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-success)', transition: 'width 0.3s ease' }} />
                        </div>
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {totalItems === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', textAlign: 'center', gap: '16px' }}>
                        <FiShoppingCart size={48} style={{ opacity: 0.3 }} />
                        <p>A sua lista de compras está vazia.<br />Adicione receitas ao planeamento semanas!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {grouped.map(group => (
                            <section key={group.id}>
                                <div style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    color: 'var(--text-tertiary)',
                                    borderBottom: '1px solid var(--bg-tertiary)',
                                    paddingBottom: '6px',
                                    marginBottom: '4px',
                                }}>
                                    {group.label}
                                </div>
                                <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {group.items.map((item) => (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => toggleIngredient(item.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '12px',
                                                    width: '100%',
                                                    padding: '12px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    textAlign: 'left',
                                                    background: item.checked ? 'var(--bg-tertiary)' : 'transparent',
                                                    opacity: item.checked ? 0.6 : 1,
                                                }}
                                            >
                                                <div style={{ color: item.checked ? 'var(--accent-success)' : 'var(--text-tertiary)', marginTop: '2px', flexShrink: 0 }}>
                                                    {item.checked ? <FiCheckCircle size={18} /> : <FiCircle size={18} />}
                                                </div>
                                                <span style={{
                                                    fontSize: '0.85rem',
                                                    color: item.checked ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                                    textDecoration: item.checked ? 'line-through' : 'none',
                                                    lineHeight: 1.4
                                                }}>
                                                    {item.displayText}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
}
