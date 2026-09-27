// OMNISTRIH AI V2 - ADAPTIVE DEVICE EXPERIENCE CONTEXT & HOOK

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AdaptiveDeviceExperience,
  AdaptiveDeviceState,
} from "../utils/adaptiveDeviceExperience";

interface AdaptiveDeviceContextType extends AdaptiveDeviceState {
  setMobileSafeMode: (enabled: boolean) => void;
}

const AdaptiveDeviceContext = createContext<AdaptiveDeviceContextType | null>(null);

export const AdaptiveDeviceExperienceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AdaptiveDeviceState>(() =>
    AdaptiveDeviceExperience.getState()
  );

  useEffect(() => {
    const unsubscribe = AdaptiveDeviceExperience.subscribe((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  const setMobileSafeMode = (enabled: boolean) => {
    AdaptiveDeviceExperience.setMobileSafeMode(enabled);
  };

  return (
    <AdaptiveDeviceContext.Provider value={{ ...state, setMobileSafeMode }}>
      {children}
    </AdaptiveDeviceContext.Provider>
  );
};

export const useAdaptiveDeviceExperience = (): AdaptiveDeviceContextType => {
  const ctx = useContext(AdaptiveDeviceContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    const curr = AdaptiveDeviceExperience.getState();
    return {
      ...curr,
      setMobileSafeMode: (e) => AdaptiveDeviceExperience.setMobileSafeMode(e),
    };
  }
  return ctx;
};
