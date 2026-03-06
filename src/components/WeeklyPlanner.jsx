import { useState } from 'react';
import { usePlanner } from '../contexts/PlannerContext';
import { FiTrash2, FiPlus, FiCalendar, FiZap } from 'react-icons/fi';

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function WeeklyPlanner() {
    const { planner, setMeal, removeMeal, clearWeek, generateBalancedWeek, viewRecipe } = usePlanner();
    const [dragOverCell, setDragOverCell] = useState(null); // format: "Day-Meal"

    const handleDragOver = (e, day, meal) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'copy';
        setDragOverCell(`${day}-${meal}`);
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = (e, day, mealType) => {
        e.preventDefault();
        setDragOverCell(null);
        const recipeIdStr = e.dataTransfer.getData('recipeId');
        if (recipeIdStr) {
            setMeal(day, mealType, parseInt(recipeIdStr, 10));
        }
    };

    return (
        <main className="app-main glass-panel">
            <div className="panel-header panel-header-top">
                <h2 className="panel-title heading-gradient">
                    <FiCalendar /> Planeamento Semanal
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-primary" onClick={generateBalancedWeek} style={{ background: 'var(--accent-success)' }}>
                        <FiZap /> Gerar Menu Equilibrado
                    </button>
                    <button className="btn-secondary" onClick={clearWeek}>
                        <FiTrash2 /> Limpar Menu
                    </button>
                </div>
            </div>

            <div className="planner-grid" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                {DAYS.map(day => (
                    <div key={day} style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-subtle)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>
                            {day}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', padding: '12px', gap: '8px' }}>
                            {/* ALMOÇO CELL */}
                            <MealCell
                                day={day}
                                meal="almoço"
                                recipe={planner[day].almoço}
                                isOver={dragOverCell === `${day}-almoço`}
                                onDragOver={(e) => handleDragOver(e, day, "almoço")}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, day, "almoço")}
                                onRemove={() => removeMeal(day, "almoço")}
                                onView={() => planner[day].almoço && viewRecipe(planner[day].almoço)}
                            />

                            {/* JANTAR CELL */}
                            <MealCell
                                day={day}
                                meal="jantar"
                                recipe={planner[day].jantar}
                                isOver={dragOverCell === `${day}-jantar`}
                                onDragOver={(e) => handleDragOver(e, day, "jantar")}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, day, "jantar")}
                                onRemove={() => removeMeal(day, "jantar")}
                                onView={() => planner[day].jantar && viewRecipe(planner[day].jantar)}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}

function MealCell({ day, meal, recipe, isOver, onDragOver, onDragLeave, onDrop, onRemove, onView }) {
    const isLunch = meal === 'almoço';

    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
                minHeight: '80px',
                border: `2px dashed ${isOver ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
                backgroundColor: isOver ? 'var(--accent-primary-light)' : (recipe ? 'var(--bg-secondary)' : 'var(--bg-primary)'),
                boxShadow: recipe ? 'var(--shadow-sm)' : 'none',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                position: 'relative',
                opacity: isOver ? 0.8 : 1,
                cursor: recipe ? 'pointer' : 'default'
            }}
            onClick={(e) => {
                if (recipe && !e.target.closest('button')) {
                    onView();
                }
            }}
        >
            <div style={{
                position: 'absolute', top: '8px', right: '8px',
                fontSize: '0.7rem', fontWeight: 600, color: isLunch ? '#FFC078' : '#4C6EF5',
                textTransform: 'uppercase', letterSpacing: '1px'
            }}>
                {meal}
            </div>

            {!recipe ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem', padding: '10px 0' }}>
                    Arraste uma receita para aqui
                </div>
            ) : (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '30px' }}>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {recipe.title}
                    </strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{recipe.time}</span>
                        <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{recipe.origin}</span>
                    </div>

                    <button
                        onClick={onRemove}
                        style={{ position: 'absolute', bottom: '8px', right: '8px', color: 'var(--accent-danger)', background: 'white', border: '1px solid #ffd8d8', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Remover"
                    >
                        <FiTrash2 size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}
