import React, { useEffect } from 'react';
import { ProjectProvider, useProject } from './state/ProjectContext';
import Step1_InitialData from './steps/Step1_InitialData';
import Step2_Windows from './steps/Step2_Windows';
import Step3_DeviceType from './steps/Step3_DeviceType';
import Step4_DeviceSelection from './steps/Step4_DeviceSelection';
import Step5_Valves from './steps/Step5_Valves';
import Step6_Specification from './steps/Step6_Specification';
import Step7_Piping from './steps/Step7_Piping';
import Step8_Contractor from './steps/Step8_Contractor';
import Step9_Brands from './steps/Step9_Brands';
import Step10_Summary from './steps/Step10_Summary';
import './App.css';

function AppContent() {
  const { dispatch } = useProject();

  useEffect(() => {
    Promise.all([
      fetch('/data/catalog_radiators.json').then(r => r.json()),
      fetch('/data/catalog_convectors.json').then(r => r.json()),
      fetch('/data/contractors.json').then(r => r.json()),
      fetch('/data/brands.json').then(r => r.json()),
      fetch('/data/price_matrix.json').then(r => r.json()),
    ]).then(([radiators, convectors, contractors, brands, priceMatrix]) => {
      dispatch({
        type: 'SET',
        payload: {
          catalogs: { radiators, convectors },
          contractorsData: contractors,
          brandsData: brands,
          priceMatrix,
        },
      });
    });
  }, [dispatch]);

  return (
    <div className="container">
      <h1>Расчёт отопления</h1>
      <p className="subtitle">Подбор приборов, расценки работ, стоимость материалов</p>
      <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text2)', marginTop: -8, marginBottom: 8 }}>v1.5.1</div>

      <Step1_InitialData />
      <Step2_Windows />
      <Step3_DeviceType />
      <Step4_DeviceSelection />
      <Step5_Valves />
      <Step6_Specification />
      <Step7_Piping />
      <Step8_Contractor />
      <Step9_Brands />
      <Step10_Summary />
    </div>
  );
}

function App() {
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  );
}

export default App;
