/**
 * Pochette générative.
 *
 * Une track sans pochette n'a aucune identité visuelle : sur un tableau, dix
 * cartes se ressemblent. On dérive donc une composition abstraite de son
 * identifiant — toujours la même pour la même track, jamais la même d'une track
 * à l'autre — teintée par la couleur de son alias.
 *
 * Ce n'est pas une analyse audio et cela ne prétend pas en être une : ce sont
 * des formes, comme une sérigraphie sur une pochette blanche. Dès qu'une vraie
 * pochette est envoyée, elle prend la place.
 */

export interface CoverShape {
  /** Position et rayon en pourcentage de la boîte, pour rester indépendant de la taille. */
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

export interface Cover {
  /** Angle du dégradé de fond, en degrés. */
  angle: number;
  /** Disque plein, décentré. */
  disc: CoverShape;
  /** Anneau, façon sillon de vinyle. */
  ring: CoverShape;
  /** Bande diagonale traversant la composition. */
  bandY: number;
  bandHeight: number;
  bandAngle: number;
  /** Hauteurs des barres du bas, entre 0 et 1. */
  bars: number[];
  /** Décalage de teinte appliqué à la seconde couleur du dégradé. */
  hueShift: number;
}

/** Hachage entier stable, indépendant de la plateforme. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire déterministe, amorcé par le hachage. */
function rng(state: number): () => number {
  let s = state || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const between = (r: () => number, min: number, max: number) => min + r() * (max - min);

export function coverFor(seed: string): Cover {
  const next = rng(hash(seed));

  return {
    angle: Math.round(between(next, 100, 260)),
    disc: {
      cx: Math.round(between(next, 18, 78)),
      cy: Math.round(between(next, 14, 56)),
      r: Math.round(between(next, 26, 48)),
      opacity: Number(between(next, 0.1, 0.2).toFixed(3)),
    },
    ring: {
      cx: Math.round(between(next, 22, 82)),
      cy: Math.round(between(next, 26, 74)),
      r: Math.round(between(next, 30, 58)),
      opacity: Number(between(next, 0.14, 0.26).toFixed(3)),
    },
    bandY: Math.round(between(next, 40, 78)),
    bandHeight: Math.round(between(next, 5, 13)),
    bandAngle: Math.round(between(next, -28, 28)),
    // Cinq barres suffisent à donner un rythme sans faire croire à une analyse.
    bars: Array.from({ length: 5 }, () => Number(between(next, 0.22, 1).toFixed(3))),
    hueShift: Math.round(between(next, -38, 38)),
  };
}
