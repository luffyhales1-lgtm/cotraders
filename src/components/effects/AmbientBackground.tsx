import React from 'react';

/**
 * Full-viewport premium 3D ambiance: a slowly drifting multi-color aurora plus
 * a few floating light orbs. Purely decorative (pointer-events: none) and fixed
 * at z-0, so page content placed at `relative z-10` floats above it while the
 * glow shows through the transparent gaps between cards — the "3D depth" look
 * from the reference site, with no 3D engine and zero layout cost.
 *
 * Usage: drop <AmbientBackground /> once inside a page root and make the main
 * content wrapper `relative z-10`.
 */
export const AmbientBackground: React.FC = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* drifting aurora field */}
      <div className="aurora-bg" />

      {/* soft light orbs (defined in globals.css .ambient-orb — static, low-cost) */}
      <div
        className="ambient-orb"
        style={{ top: '-6rem', left: '-4rem', width: '22rem', height: '22rem', background: 'radial-gradient(circle, hsl(350 85% 66% / 0.28), transparent 70%)' }}
      />
      <div
        className="ambient-orb"
        style={{ top: '20%', right: '-6rem', width: '24rem', height: '24rem', background: 'radial-gradient(circle, hsl(14 90% 62% / 0.22), transparent 70%)' }}
      />
      <div
        className="ambient-orb"
        style={{ bottom: '-8rem', left: '30%', width: '26rem', height: '26rem', background: 'radial-gradient(circle, hsl(336 85% 66% / 0.20), transparent 70%)' }}
      />
    </div>
  );
};

export default AmbientBackground;
