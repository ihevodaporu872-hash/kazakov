import React from 'react';

export default function RadioCards({ options, value, onChange, name }) {
  return (
    <div className="radio-cards">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`radio-card ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <div className="rc-title">{opt.label}</div>
          {opt.desc && <div className="rc-desc">{opt.desc}</div>}
        </label>
      ))}
    </div>
  );
}
