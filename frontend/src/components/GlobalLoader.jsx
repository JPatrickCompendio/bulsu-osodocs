import React from 'react';

const GlobalLoader = ({ isExiting = false }) => {
  return (
    <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black transition-all duration-[600ms] ease-in-out ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-in fade-in duration-200'}`}>
      {/* Background Video */}
      <video 
        autoPlay 
        loop 
        muted 
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
      >
        <source src="/loginbgvid.mp4" type="video/mp4" />
      </video>
      
      {/* Gradient Overlay for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20"></div>

      {/* Foreground Content */}
      <div className={`relative z-10 flex flex-col items-center transition-all duration-[600ms] ease-in-out ${isExiting ? 'scale-[30] opacity-0' : 'scale-100 opacity-100 animate-in zoom-in-95 duration-500'}`}>
        <div className="w-28 h-28 bg-white rounded-full p-3 mb-6 shadow-[0_0_40px_rgba(255,255,255,0.15)] flex items-center justify-center">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-xl animate-pulse" />
        </div>
        
        <div className={`flex flex-col items-center gap-4 transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
          <div className="w-10 h-10 border-4 border-secondary-gold border-t-transparent rounded-full animate-spin"></div>
          <span className="text-secondary-gold font-bold tracking-[0.2em] text-xs uppercase animate-pulse">
            Loading Application...
          </span>
        </div>
      </div>
    </div>
  );
};

export default GlobalLoader;
