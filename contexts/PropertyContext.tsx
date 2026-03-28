import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Property, PropertyStatus, Filters, View } from '../types';
import {
  fetchFilteredProperties,
  fetchFilterValues,
  updatePropertyStatus,
  bulkUpdateProperties,
  PaginatedResult,
  SortConfig,
  FilterValues,
} from '../services/propertyService';
import { supabase } from '../supabase';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const initialFilters: Filters = {
  location: 'All',
  portal: 'All',
  minPrice: '',
  maxPrice: '',
  minDiscount: '',
  status: 'All',
  minBeds: '',
  maxBeds: '',
  minPricePerSqm: '',
  maxPricePerSqm: '',
  minPricePerTotalSqm: '',
  maxPricePerTotalSqm: '',
  minDaysOnMarket: '',
  maxDaysOnMarket: '',
  minArea: '',
  maxArea: '',
  isPotentialOpportunity: false,
  showOnlyDiscarded: false,
  propertyType: 'All',
  searchUrl: '',
};

const PAGE_SIZE = 50;

interface PropertyContextType {
  // Data
  properties: Property[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  initialFilters: Filters;
  filterValues: FilterValues;

  // Pagination
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  totalPages: number;

  // Sort
  sort: SortConfig;
  setSort: (sort: SortConfig) => void;

  // View
  activeView: View;
  setActiveView: (view: View) => void;

  // Selection
  selectedProperty: Property | null;
  setSelectedProperty: (property: Property | null) => void;

  // Actions
  handleUpdateStatus: (propertyId: string, status: PropertyStatus) => Promise<void>;
  handleBulkUpdate: (propertyIds: string[], updates: Partial<Pick<Property, 'status' | 'is_potential_opportunity'>>) => Promise<void>;
  refresh: () => void;
}

const PropertyContext = createContext<PropertyContextType>(null!);

export const useProperties = () => useContext(PropertyContext);

export const PropertyProvider: React.FC<{ children: React.ReactNode; isAuthenticated: boolean }> = ({ children, isAuthenticated }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [filterValues, setFilterValues] = useState<FilterValues>({ portals: [], zonas: [], propertyTypes: [] });

  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [activeView, setActiveView] = useState<View>('metrics');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Debounce filters so rapid typing doesn't spam the server
  const debouncedFilters = useDebouncedValue(filters, 400);

  // Track request ID to prevent stale responses from overwriting newer data
  const requestIdRef = useRef(0);

  // Reset page and filters when view changes
  const handleViewChange = useCallback((view: View) => {
    setActiveView(view);
    setFilters(initialFilters);
    setPage(0);
  }, []);

  // Fetch filter dropdown values once
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchFilterValues().then(setFilterValues).catch(console.error);
  }, [isAuthenticated]);

  // Main data fetching effect — triggers on debounced filter changes, page, sort, or view changes
  useEffect(() => {
    // Only fetch for views that show property lists
    const propertyViews: View[] = ['inventory', 'opportunities', 'anomalies'];
    if (!isAuthenticated || !propertyViews.includes(activeView)) return;

    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    fetchFilteredProperties(debouncedFilters, activeView, sort, page, PAGE_SIZE)
      .then((result: PaginatedResult) => {
        // Only apply if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setProperties(result.data);
          setTotalCount(result.totalCount);
          setIsLoading(false);
        }
      })
      .catch((e: Error) => {
        if (currentRequestId === requestIdRef.current) {
          // Handle expired auth
          if (e.message?.includes('Invalid Refresh Token') || e.message?.includes('Refresh Token Not Found')) {
            supabase?.auth.signOut();
            return;
          }
          setError(e.message);
          setIsLoading(false);
        }
      });
  }, [isAuthenticated, debouncedFilters, activeView, sort, page]);

  // Reset page to 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedFilters, activeView]);

  const handleUpdateStatus = useCallback(async (propertyId: string, status: PropertyStatus) => {
    try {
      await updatePropertyStatus(propertyId, status);
      // Update locally to avoid a full refetch
      setProperties(prev => prev.map(p => p.id === propertyId ? { ...p, status } : p));
      if (selectedProperty?.id === propertyId) {
        setSelectedProperty(prev => prev ? { ...prev, status } : null);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }, [selectedProperty]);

  const handleBulkUpdate = useCallback(async (propertyIds: string[], updates: Partial<Pick<Property, 'status' | 'is_potential_opportunity'>>) => {
    try {
      await bulkUpdateProperties(propertyIds, updates);
      // Refresh from server to get accurate data after bulk changes
      requestIdRef.current++;
      const result = await fetchFilteredProperties(debouncedFilters, activeView, sort, page, PAGE_SIZE);
      setProperties(result.data);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error('Failed to bulk update properties:', error);
    }
  }, [debouncedFilters, activeView, sort, page]);

  const refresh = useCallback(() => {
    requestIdRef.current++;
    const currentRequestId = requestIdRef.current;
    setIsLoading(true);

    fetchFilteredProperties(debouncedFilters, activeView, sort, page, PAGE_SIZE)
      .then((result) => {
        if (currentRequestId === requestIdRef.current) {
          setProperties(result.data);
          setTotalCount(result.totalCount);
          setIsLoading(false);
        }
      })
      .catch((e) => {
        if (currentRequestId === requestIdRef.current) {
          setError(e.message);
          setIsLoading(false);
        }
      });

    // Also refresh filter values
    fetchFilterValues().then(setFilterValues).catch(console.error);
  }, [debouncedFilters, activeView, sort, page]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <PropertyContext.Provider value={{
      properties,
      totalCount,
      isLoading,
      error,
      filters,
      setFilters,
      initialFilters,
      filterValues,
      page,
      setPage,
      pageSize: PAGE_SIZE,
      totalPages,
      sort,
      setSort,
      activeView,
      setActiveView: handleViewChange,
      selectedProperty,
      setSelectedProperty,
      handleUpdateStatus,
      handleBulkUpdate,
      refresh,
    }}>
      {children}
    </PropertyContext.Provider>
  );
};
