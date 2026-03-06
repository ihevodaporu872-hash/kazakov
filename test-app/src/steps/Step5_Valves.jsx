import React from 'react';
import StepCard from '../components/StepCard';
import RadioCards from '../components/RadioCards';
import { useProject } from '../state/ProjectContext';
import { THERMO_OPTIONS, VALVE_OPTIONS } from '../calc/heatCalc';

export default function Step5_Valves() {
  const { state, dispatch } = useProject();

  const handleNext = () => {
    dispatch({ type: 'NEXT_STEP' });
  };

  return (
    <StepCard step={5} title="Термоголовка и регулирующие клапаны">
      <div className="info-box">
        {state.deviceType === 'inFloor'
          ? 'Внутрипольные конвекторы: выберите термоголовку с выносным или встроенным датчиком.'
          : 'Уточните наличие регулирующих клапанов в составе прибора.'}
      </div>

      <h4 style={{ marginTop: 16, marginBottom: 8 }}>Термоголовка</h4>
      <RadioCards
        name="thermo"
        options={THERMO_OPTIONS}
        value={state.thermoHead}
        onChange={v => dispatch({ type: 'SET', payload: { thermoHead: v } })}
      />

      <h4 style={{ marginTop: 16, marginBottom: 8 }}>Регулирующий клапан</h4>
      <RadioCards
        name="valve"
        options={VALVE_OPTIONS}
        value={state.valve}
        onChange={v => dispatch({ type: 'SET', payload: { valve: v } })}
      />

      <button className="btn btn-primary" onClick={handleNext} style={{ marginTop: 16 }}>Сформировать спецификацию →</button>
    </StepCard>
  );
}
