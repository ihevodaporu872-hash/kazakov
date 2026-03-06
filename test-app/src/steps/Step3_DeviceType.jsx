import React from 'react';
import StepCard from '../components/StepCard';
import RadioCards from '../components/RadioCards';
import { useProject } from '../state/ProjectContext';

const DEVICE_TYPES = [
  { value: 'inFloor', label: 'Внутрипольные', desc: 'Конвекторы в полу. Высота ~0.15м.' },
  { value: 'floor', label: 'Напольные', desc: 'Напольные конвекторы/радиаторы. Высота = простенок − стяжка − 0.2м.' },
  { value: 'wall', label: 'Настенные', desc: 'Радиаторы / настенные конвекторы. Высота = простенок − стяжка − 0.2м.' },
];

export default function Step3_DeviceType() {
  const { state, dispatch } = useProject();

  const handleNext = () => {
    let h;
    if (state.deviceType === 'inFloor') {
      h = 150;
    } else if (state.wallHeight_mm > 0) {
      h = state.wallHeight_mm - state.screedHeight_mm - 200;
      if (h < 200) h = 300;
    } else {
      h = 500;
    }
    dispatch({ type: 'SET', payload: { deviceHeight_mm: h } });
    dispatch({ type: 'NEXT_STEP' });
  };

  return (
    <StepCard step={3} title="Тип прибора отопления">
      <RadioCards
        name="deviceType"
        options={DEVICE_TYPES}
        value={state.deviceType}
        onChange={v => dispatch({ type: 'SET', payload: { deviceType: v } })}
      />
      <button className="btn btn-primary" onClick={handleNext} style={{ marginTop: 16 }}>Подобрать приборы →</button>
    </StepCard>
  );
}
