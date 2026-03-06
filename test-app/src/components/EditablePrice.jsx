import React, { useState } from 'react';
import { fmt } from '../calc/heatCalc';
import { getPriceStyle, getPriceLabel } from '../calc/contractorPricing';

export default function EditablePrice({ price, source, sourceLabel, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  const style = getPriceStyle(source);
  const label = getPriceLabel(source, sourceLabel);

  const handleClick = () => {
    setVal(price || '');
    setEditing(true);
  };

  const handleSave = () => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      onSave(num);
    }
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number"
        className="price-input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        style={{ width: '100px' }}
      />
    );
  }

  return (
    <div className="editable-price" style={style} onClick={handleClick} title="Нажмите для редактирования">
      <span className="price-value">{price != null ? fmt(price) : '—'}</span>
      {label && <span className="price-source">{label}</span>}
    </div>
  );
}
