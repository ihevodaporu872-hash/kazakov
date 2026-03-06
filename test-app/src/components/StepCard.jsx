import React from 'react';
import { useProject } from '../state/ProjectContext';

export default function StepCard({ step, title, children }) {
  const { state } = useProject();
  const isActive = state.currentStep === step;
  const isDone = state.maxStep > step;
  const isLocked = state.maxStep < step;

  return (
    <div
      className={`step ${isLocked ? 'disabled' : ''} ${isActive ? 'active-step' : ''}`}
      id={`step${step}`}
    >
      <div className="step-header">
        <div className={`step-num ${isDone ? 'done' : ''}`}>{step}</div>
        <div className="step-title">{title}</div>
      </div>
      {!isLocked && children}
    </div>
  );
}
