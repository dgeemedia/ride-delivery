// mobile/src/context/ScrollContext.js
import React, { createContext, useContext } from 'react';
import Animated, { useSharedValue } from 'react-native-reanimated';

const ScrollContext = createContext();

export const ScrollProvider = ({ children }) => {
  const scrollY = useSharedValue(0);
  return (
    <ScrollContext.Provider value={scrollY}>
      {children}
    </ScrollContext.Provider>
  );
};

export const useScrollY = () => useContext(ScrollContext);