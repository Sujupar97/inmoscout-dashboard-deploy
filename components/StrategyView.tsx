import React, { useMemo, useState } from 'react';
import { Property, PropertyStatus } from '../types';
import { CalculatorIcon } from './icons/CalculatorIcon';
import { MultiplyIcon } from './icons/MultiplyIcon';
import { propertyStatusTranslations } from '../utils/translations';
import { FunnelIcon } from './icons/FunnelIcon';
import { FilterIcon } from './icons/FilterIcon';
import { TargetIcon } from './icons/TargetIcon';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';


// Sub-componentes
const BarChart: React.FC<{ data: { label: string, value: number }[], title: string }> = ({ data, title }) => {
    const maxValue = Math.max(...data.map(d => d.value), 0);
    return (
        <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h3>
            <div className="space-y-3">
                {data.length === 0 && <p className="text-[var(--text-secondary)] text-center py-4">No hay datos para mostrar.</p>}
                {data.map(item => (
                    <div key={item.label} className="grid grid-cols-6 items-center gap-2">
                        <span className="col-span-2 text-sm text-[var(--text-secondary)] truncate pr-2" title={item.label}>{item.label}</span>
                        <div className="col-span-3 bg-[var(--bg-tertiary)] rounded-full h-4">
                            <div
                                className="bg-[var(--primary-accent)] h-4 rounded-full transition-all duration-500"
                                style={{ width: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : '0%' }}
                            ></div>
                        </div>
                        <span className="col-span-1 text-sm font-semibold text-[var(--text-primary)] text-right">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SliderControl: React.FC<{
    label: string,
    value: string,
    setValue: (val: string) => void,
    min: number,
    max: number,
    step: number,
    unit: string
}> = ({ label, value, setValue, min, max, step, unit }) => (
    <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)]">{label}</label>
        <div className="flex items-center space-x-4 mt-2">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--primary-accent)]"
            />
            <span className="font-bold text-[var(--primary-accent-text)] text-lg w-24 text-right">{value}{unit}</span>
        </div>
    </div>
);


// Componente principal
export const StrategyView: React.FC<{ properties: Property[] }> = ({ properties }) => {
    const [dealsPerMonth, setDealsPerMonth] = useState('2');
    const [commissionRate, setCommissionRate] = useState('3');

    const strategicData = useMemo(() => {
        const opportunities = properties.filter(p => p.discountPercentage !== undefined && p.discountPercentage <= -30);
        const avgOpportunityPrice = opportunities.length > 0 ? opportunities.reduce((sum, p) => sum + p.price, 0) / opportunities.length : 0;
        
        const statusCounts = opportunities.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {} as Record<PropertyStatus, number>);
        
        // FIX: Cast `value` to number as Object.entries can lose type information, causing issues in the `sort` method.
        const pipelineData = Object.entries(statusCounts).map(([label, value]) => ({ 
          label: propertyStatusTranslations[label as PropertyStatus] || label, 
          value: value as number
        })).sort((a,b) => b.value - a.value);

        return {
            opportunitiesDetected: opportunities.length,
            avgOpportunityPrice,
            pipelineData,
            totalProperties: properties.length
        };
    }, [properties]);

    const projection = useMemo(() => {
        const numDeals = parseFloat(dealsPerMonth) || 0;
        const comRate = parseFloat(commissionRate) || 0;

        if (numDeals === 0 || comRate === 0 || strategicData.avgOpportunityPrice === 0) {
            return { commissionPerDeal: 0, monthlyIncome: 0, annualProjection: 0 };
        }
        const commissionPerDeal = strategicData.avgOpportunityPrice * (comRate / 100);
        const monthlyIncome = commissionPerDeal * numDeals;
        const annualProjection = monthlyIncome * 12;

        return { commissionPerDeal, monthlyIncome, annualProjection };
    }, [dealsPerMonth, commissionRate, strategicData.avgOpportunityPrice]);


    return (
        <div className="space-y-8">
            <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)]">
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Tu Potencial de Crecimiento</h2>
                <p className="text-[var(--text-secondary)] mb-6 max-w-3xl">
                    Descubre cómo nuestro sistema transforma el ruido del mercado en ganancias reales para tu negocio.
                </p>
                <div className="flex flex-col md:flex-row items-center justify-around space-y-4 md:space-y-0 bg-[var(--bg-primary)] p-6 rounded-lg">
                    <div className="text-center">
                        <FunnelIcon className="h-10 sm:h-12 w-10 sm:w-12 mx-auto text-[var(--text-tertiary)]"/>
                        <p className="font-bold text-xl sm:text-2xl text-[var(--text-primary)] mt-2">{strategicData.totalProperties.toLocaleString('es-AR')}+</p>
                        <p className="text-sm text-[var(--text-secondary)]">Propiedades en Mercado</p>
                    </div>
                    <div className="text-[var(--text-tertiary)] transform rotate-90 md:rotate-0">
                        <ChevronDownIcon className="h-6 w-6 md:hidden" />
                        <svg className="hidden md:block" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 5L21 12L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                     <div className="text-center">
                        <FilterIcon className="h-10 sm:h-12 w-10 sm:w-12 mx-auto text-[var(--primary-accent-text)]"/>
                        <p className="font-bold text-xl sm:text-2xl text-[var(--primary-accent-text)] mt-2">Filtro IA</p>
                        <p className="text-sm text-[var(--text-secondary)]">Análisis Inteligente</p>
                    </div>
                     <div className="text-[var(--text-tertiary)] transform rotate-90 md:rotate-0">
                        <ChevronDownIcon className="h-6 w-6 md:hidden" />
                        <svg className="hidden md:block" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 5L21 12L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                     <div className="text-center">
                        <TargetIcon className="h-10 sm:h-12 w-10 sm:w-12 mx-auto text-teal-400"/>
                        <p className="font-bold text-xl sm:text-2xl text-teal-400 mt-2">{strategicData.opportunitiesDetected.toLocaleString('es-AR')}</p>
                        <p className="text-sm text-[var(--text-secondary)]">Oportunidades Reales</p>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)]">
                <div className="flex items-center mb-4">
                    <CalculatorIcon className="h-8 w-8 text-[var(--primary-accent-text)] mr-3"/>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">Define tu Estrategia</h2>
                </div>
                 <p className="text-[var(--text-secondary)] mb-6 max-w-3xl">
                  Proyecta tu ganancia definiendo cuántas de estas oportunidades puedes gestionar al mes.
                </p>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <SliderControl
                        label="Oportunidades a gestionar/mes"
                        value={dealsPerMonth}
                        setValue={setDealsPerMonth}
                        min={0} max={10} step={1} unit=""
                    />
                    <SliderControl
                        label="Tu comisión promedio"
                        value={commissionRate}
                        setValue={setCommissionRate}
                        min={0} max={6} step={0.5} unit="%"
                    />
                </div>

                <div className="bg-[var(--bg-primary)] p-4 sm:p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-center text-[var(--text-primary)] mb-6">Proyección de Ingreso Adicional</h3>
                    <div className="flex flex-col md:flex-row items-center justify-center space-y-6 md:space-y-0 md:space-x-4 flex-wrap">
                        
                        <div className="text-center p-2">
                            <p className="text-sm text-[var(--text-secondary)]">Comisión por Op.</p>
                            <p className="font-bold text-lg sm:text-xl text-[var(--text-primary)]">USD {projection.commissionPerDeal.toLocaleString('es-AR', {maximumFractionDigits: 0})}</p>
                        </div>
                        
                        <MultiplyIcon className="h-5 w-5 text-[var(--text-tertiary)]"/>

                         <div className="text-center p-2">
                            <p className="text-sm text-[var(--text-secondary)]">Ingreso Mensual</p>
                            <p className="font-bold text-lg sm:text-xl text-[var(--text-primary)]">USD {projection.monthlyIncome.toLocaleString('es-AR', {maximumFractionDigits: 0})}</p>
                        </div>

                         <TrendingUpIcon className="h-5 w-5 text-[var(--text-tertiary)] hidden md:block"/>

                        <div className="w-full md:w-auto text-center bg-[var(--primary-accent)] p-4 rounded-lg shadow-lg mt-4 md:mt-0">
                            <p className="text-sm text-white font-semibold uppercase tracking-wider">Ingreso Adicional Anual</p>
                            <p className="font-bold text-3xl sm:text-4xl text-white">USD {projection.annualProjection.toLocaleString('es-AR', {maximumFractionDigits: 0})}</p>
                        </div>

                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Estado de tu Pipeline Actual</h2>
                 <BarChart title="Estado de las Oportunidades Detectadas" data={strategicData.pipelineData} />
            </div>
        </div>
    );
};
