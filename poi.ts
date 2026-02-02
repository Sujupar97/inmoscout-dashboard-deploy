// This file contains a list of key Points of Interest (POIs) in Buenos Aires.
// It serves as a static data source for future proximity analysis features.
// In a real application, this could come from a database or a more extensive GIS service.

export interface PointOfInterest {
  name: string;
  category: 'Subte' | 'Parque' | 'Universidad';
  latitude: number;
  longitude: number;
}

export const POIs: PointOfInterest[] = [
  // Subte Linea D
  { name: 'Estación Congreso de Tucumán', category: 'Subte', latitude: -34.5639, longitude: -58.4658 },
  { name: 'Estación Juramento', category: 'Subte', latitude: -34.5617, longitude: -58.4571 },
  { name: 'Estación José Hernández', category: 'Subte', latitude: -34.5694, longitude: -58.4528 },
  { name: 'Estación Olleros', category: 'Subte', latitude: -34.5739, longitude: -58.4480 },
  { name: 'Estación Ministro Carranza', category: 'Subte', latitude: -34.5779, longitude: -58.4429 },
  { name: 'Estación Palermo', category: 'Subte', latitude: -34.5823, longitude: -58.4239 },
  { name: 'Estación Plaza Italia', category: 'Subte', latitude: -34.5804, longitude: -58.4207 },
  
  // Parques
  { name: 'Bosques de Palermo', category: 'Parque', latitude: -34.5707, longitude: -58.4168 },
  { name: 'Parque Centenario', category: 'Parque', latitude: -34.6062, longitude: -58.4398 },
  { name: 'Parque Rivadavia', category: 'Parque', latitude: -34.6150, longitude: -58.4328 },
  
  // Universidades
  { name: 'Ciudad Universitaria (UBA)', category: 'Universidad', latitude: -34.5422, longitude: -58.4410 },
  { name: 'Facultad de Medicina (UBA)', category: 'Universidad', latitude: -34.5969, longitude: -58.4005 },
  { name: 'Universidad de Palermo (UP)', category: 'Universidad', latitude: -34.5980, longitude: -58.4120 },
];