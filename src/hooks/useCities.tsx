import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface City {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCity {
  id: string;
  user_id: string;
  city_id: string;
  created_at: string;
}

export function useCities() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all cities (for catalog management)
  const { data: allCities = [], isLoading: isLoadingAll, refetch: refetchAll } = useQuery({
    queryKey: ['cities_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as City[];
    },
  });

  // Fetch active cities only (for selectors)
  const { data: activeCities = [], isLoading: isLoadingActive } = useQuery({
    queryKey: ['cities_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as City[];
    },
  });

  // Fetch user's assigned cities
  const { data: userCities = [], isLoading: isLoadingUserCities } = useQuery({
    queryKey: ['user_cities', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_cities')
        .select('*, cities(*)')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get city IDs the user can access
  const accessibleCityIds = isAdmin 
    ? activeCities.map(c => c.id) 
    : userCities.map((uc: any) => uc.city_id);

  // Get accessible cities with full data
  const accessibleCities = isAdmin 
    ? activeCities 
    : userCities.map((uc: any) => uc.cities).filter(Boolean) as City[];

  // Helper to invalidate queries
  const invalidateCities = () => {
    queryClient.invalidateQueries({ queryKey: ['cities_all'] });
    queryClient.invalidateQueries({ queryKey: ['cities_active'] });
    queryClient.invalidateQueries({ queryKey: ['user_cities'] });
  };

  // Convert cities to select options
  const cityOptions = activeCities.map(city => ({
    value: city.id,
    label: city.name,
  }));

  // Get city name by ID
  const getCityName = (cityId: string | null): string => {
    if (!cityId) return '-';
    const city = allCities.find(c => c.id === cityId);
    return city?.name || '-';
  };

  return {
    // All cities (for admin catalog)
    allCities,
    isLoadingAll,
    refetchAll,
    
    // Active cities (for selectors)
    activeCities,
    isLoadingActive,
    
    // User's accessible cities
    accessibleCities,
    accessibleCityIds,
    userCities,
    isLoadingUserCities,
    
    // Helpers
    cityOptions,
    getCityName,
    invalidateCities,
  };
}

// Hook for managing user city assignments (admin only)
export function useUserCityAssignments(userId: string | null) {
  const queryClient = useQueryClient();

  const { data: assignedCities = [], isLoading, refetch } = useQuery({
    queryKey: ['user_city_assignments', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_cities')
        .select('city_id')
        .eq('user_id', userId);
      if (error) throw error;
      return data.map(uc => uc.city_id);
    },
    enabled: !!userId,
  });

  const assignCity = async (cityId: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('user_cities')
      .insert({ user_id: userId, city_id: cityId });
    if (error) throw error;
    refetch();
    queryClient.invalidateQueries({ queryKey: ['user_cities'] });
  };

  const unassignCity = async (cityId: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('user_cities')
      .delete()
      .eq('user_id', userId)
      .eq('city_id', cityId);
    if (error) throw error;
    refetch();
    queryClient.invalidateQueries({ queryKey: ['user_cities'] });
  };

  const toggleCity = async (cityId: string) => {
    if (assignedCities.includes(cityId)) {
      await unassignCity(cityId);
    } else {
      await assignCity(cityId);
    }
  };

  return {
    assignedCities,
    isLoading,
    assignCity,
    unassignCity,
    toggleCity,
    refetch,
  };
}
