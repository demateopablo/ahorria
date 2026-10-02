import {
  AlertTriangle,
  Baby,
  Banknote,
  Beef,
  Briefcase,
  Bus,
  Candy,
  Car,
  Carrot,
  Circle,
  Coffee,
  CreditCard,
  Droplet,
  Dumbbell,
  Film,
  Flame,
  Fuel,
  Gift,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  Landmark,
  PawPrint,
  Pizza,
  Plane,
  Repeat,
  Shield,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Trees,
  TrendingUp,
  User,
  Users,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Icono as NombreIcono } from "@shared/iconos";

const MAPA: Record<NombreIcono, LucideIcon> = {
  circle: Circle,
  home: Home,
  zap: Zap,
  flame: Flame,
  droplet: Droplet,
  hammer: Hammer,
  trees: Trees,
  car: Car,
  fuel: Fuel,
  utensils: Utensils,
  cart: ShoppingCart,
  carrot: Carrot,
  beef: Beef,
  candy: Candy,
  pizza: Pizza,
  baby: Baby,
  paw: PawPrint,
  "heart-pulse": HeartPulse,
  user: User,
  dumbbell: Dumbbell,
  repeat: Repeat,
  smartphone: Smartphone,
  users: Users,
  gift: Gift,
  plane: Plane,
  alert: AlertTriangle,
  "credit-card": CreditCard,
  store: Store,
  wallet: Wallet,
  banknote: Banknote,
  landmark: Landmark,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
  sparkles: Sparkles,
  shirt: Shirt,
  "graduation-cap": GraduationCap,
  bus: Bus,
  film: Film,
  coffee: Coffee,
  shield: Shield,
};

export function Icono({ nombre, className, size = 20 }: { nombre: string | null | undefined; className?: string; size?: number }) {
  const C = MAPA[(nombre ?? "circle") as NombreIcono] ?? Circle;
  return <C className={className} size={size} strokeWidth={1.8} aria-hidden />;
}

/** Ícono de categoría sobre un círculo con el color de la categoría (suave). */
export function IconoCategoria({ icono, color, size = 40 }: { icono?: string | null; color?: string | null; size?: number }) {
  const c = color ?? "#64748b";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: `${c}22`, color: c }}
      aria-hidden
    >
      <Icono nombre={icono} size={Math.round(size * 0.5)} />
    </span>
  );
}
