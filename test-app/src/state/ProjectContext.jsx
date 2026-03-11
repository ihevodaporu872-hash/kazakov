import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  // Проект
  projectData: null,
  selectedBuilding: null,
  projectName: '',
  systemType: '',
  distribution: '',
  insulationThickness_mm: 13,
  floorHeight_mm: 3000,
  riserPairs: 0,
  manifoldOutputs: 0,
  heatingZones: 0,
  apartments: 0,
  area_m2: 0,
  corridorLength_m: 0,
  pexRoutingType: 'radial',   // 'radial' (лучевая) | 'series' (попутная)
  roomsPerApartment: 2,
  pexBuhtaLength_m: 200,      // длина бухты PEX
  pressFittingMaterial: 'plastic', // 'plastic' | 'metal'
  riserVelocity_ms: 0.7,      // скорость теплоносителя в стояке
  apartmentsPerFloor: 0,
  zoneBoundaries: [],          // границы зон: [17] = зона 1 до 17 этажа, зона 2 до верха

  // Шаг 1
  windowCount: 0,
  heatLoad_W: 0,
  wallHeight_mm: 0,
  screedHeight_mm: 100,
  schedule: '80/60',
  tInside: 20,
  deltaT: 50,

  // Шаг 2
  windows: [],
  totalWindowWidth_m: 0,
  totalDeviceLength_m: 0,
  powerPerMeter_W: 0,

  // Шаг 3
  deviceType: 'wall',
  deviceHeight_mm: 0,

  // Шаг 4
  perWindow: [],
  panelType: '22',
  panelHeight: 500,
  convDepth: 130,
  convFan: 'natural',

  // Шаг 5
  thermoHead: 'danfoss_ra2991',
  valve: 'included',

  // Шаг 6
  specData: [],

  // Шаг 7
  pipeBrand: 'pradex',
  pipeLenByDiam: {},

  // Шаг 8
  contractor: 'kostra',
  workPriceOverrides: {},

  // Шаг 9
  brandSelections: {
    radiator_steel: 'purmo',
    convector_infloor: 'varmann',
    valve_thermo: 'danfoss',
    pipe_pex: 'pradex',
    pipe_steel: 'market',
    insulation: 'energoflex',
  },
  materialPriceOverrides: {},

  // Навигация
  currentStep: 1,
  maxStep: 1,

  // Справочники (загружаются при старте)
  catalogs: null,
  contractorsData: null,
  brandsData: null,
  priceMatrix: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.payload };
    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.step,
        maxStep: Math.max(state.maxStep, action.step),
      };
    case 'NEXT_STEP':
      return {
        ...state,
        currentStep: state.currentStep + 1,
        maxStep: Math.max(state.maxStep, state.currentStep + 1),
      };
    case 'SET_WINDOW':
      const windows = [...state.windows];
      windows[action.index] = { ...windows[action.index], ...action.data };
      return { ...state, windows };
    case 'SET_WORK_PRICE_OVERRIDE':
      return {
        ...state,
        workPriceOverrides: {
          ...state.workPriceOverrides,
          [action.id]: action.price,
        },
      };
    case 'SET_MATERIAL_PRICE_OVERRIDE':
      return {
        ...state,
        materialPriceOverrides: {
          ...state.materialPriceOverrides,
          [action.key]: action.price,
        },
      };
    case 'SET_BRAND':
      return {
        ...state,
        brandSelections: {
          ...state.brandSelections,
          [action.category]: action.brand,
        },
      };
    default:
      return state;
  }
}

const ProjectContext = createContext();

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <ProjectContext.Provider value={{ state, dispatch }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
