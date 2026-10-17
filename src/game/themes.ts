/**
 * Sensory themes designed for different toddler developmental stages & moods.
 */

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  bgColor: string;
  bgGradient: [string, string];
  trailColors: string[];
  particleColors: string[];
  entityTypes: CharacterType[];
  soundMode: 'meadow' | 'ocean' | 'night' | 'contrast';
  isDark: boolean;
}

export type CharacterType =
  | 'kitten'
  | 'chick'
  | 'bunny'
  | 'bear'
  | 'puppy'
  | 'star'
  | 'sun'
  | 'balloon'
  | 'bubble'
  | 'flower'
  | 'fish'
  | 'jellyfish'
  | 'moon'
  | 'contrast_ring'
  | 'contrast_star';

export const THEMES: Record<string, ThemeConfig> = {
  meadow: {
    id: 'meadow',
    name: 'Taman Ceria',
    description: 'Hewan lucu & alam cerah penuh tawa',
    bgColor: '#FEF9C3',
    bgGradient: ['#FEF08A', '#FDE047'],
    trailColors: ['#F43F5E', '#FB923C', '#FACC15', '#4ADE80', '#38BDF8', '#A855F7'],
    particleColors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF8ED4', '#845EC2'],
    entityTypes: ['kitten', 'chick', 'bunny', 'bear', 'puppy', 'sun', 'balloon', 'flower', 'star'],
    soundMode: 'meadow',
    isDark: false,
  },
  ocean: {
    id: 'ocean',
    name: 'Laut Tenang',
    description: 'Gelembung lembut & teman samudra',
    bgColor: '#E0F2FE',
    bgGradient: ['#BAE6FD', '#7DD3FC'],
    trailColors: ['#38BDF8', '#0EA5E9', '#06B6D4', '#2DD4BF', '#F472B6'],
    particleColors: ['#E0F2FE', '#38BDF8', '#67E8F9', '#A7F3D0', '#FDE047'],
    entityTypes: ['fish', 'jellyfish', 'bubble', 'star', 'flower'],
    soundMode: 'ocean',
    isDark: false,
  },
  night: {
    id: 'night',
    name: 'Bintang Malam',
    description: 'Suasana tenang untuk pengantar tidur',
    bgColor: '#1E1B4B',
    bgGradient: ['#0F172A', '#1E1B4B'],
    trailColors: ['#FDE047', '#FCD34D', '#C084FC', '#818CF8', '#38BDF8'],
    particleColors: ['#FDE047', '#E0E7FF', '#C4B5FD', '#F472B6', '#38BDF8'],
    entityTypes: ['star', 'moon', 'bear', 'bubble', 'balloon'],
    soundMode: 'night',
    isDark: true,
  },
  contrast: {
    id: 'contrast',
    name: 'Kontras Tinggi (Bayi 0-12 bln)',
    description: 'Visual hitam, putih & merah untuk stimulasi mata bayi',
    bgColor: '#000000',
    bgGradient: ['#000000', '#18181B'],
    trailColors: ['#EF4444', '#FFFFFF', '#FACC15', '#DC2626'],
    particleColors: ['#FFFFFF', '#EF4444', '#FACC15', '#000000'],
    entityTypes: ['contrast_ring', 'contrast_star', 'sun', 'star', 'balloon'],
    soundMode: 'contrast',
    isDark: true,
  },
};
