import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import GlobalLoader from './GlobalLoader';

const PageTransition = ({ children }) => {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setIsNavigating(true);
    setIsExiting(false);
    
    // Reset scroll positions to top on navigation start
    window.scrollTo(0, 0);
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
      mainEl.style.overflow = 'hidden';
    }

    // Start exit animation after 600ms
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 600);

    // Unmount completely after exit animation finishes (1300ms total)
    const unmountTimer = setTimeout(() => {
      setIsNavigating(false);
      if (mainEl) {
        mainEl.style.overflow = '';
      }
    }, 1300);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(unmountTimer);
      if (mainEl) {
        mainEl.style.overflow = '';
      }
    };
  }, [location.pathname]);

  return (
    <>
      {isNavigating && <GlobalLoader isExiting={isExiting} />}
      
      {/* Page Content */}
      <div className={`transition-opacity duration-300 w-full h-full ${isNavigating ? 'opacity-0' : 'opacity-100'}`}>
        {children}
      </div>
    </>
  );
};

export default PageTransition;
