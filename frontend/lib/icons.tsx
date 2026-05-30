/** Shared Lucide icon mappings — use instead of raw emoji */
import {
  Sun, Moon, Camera, Search, X, Pencil, Trash2,
  ShoppingCart, ChefHat, Sparkles, Flame, Drumstick, Wheat,
  Droplets, UtensilsCrossed, Clock, Star, BookOpen, Users,
  AlertTriangle, MessageCircle, Calendar, Plus, Check,
  Snowflake, Sunrise, Coffee, Carrot, Egg, Dumbbell,
  type LucideIcon,
} from "lucide-react";

const icon = (iconSize: number) => ({
  size: iconSize, strokeWidth: 1.8, style: { flexShrink: 0 } as const,
});

/** Meal type → icon */
export const MEAL_ICONS: Record<string, React.ReactNode> = {
  "早餐": <Sunrise {...icon(15)} />,
  "午餐": <Sun {...icon(15)} />,
  "晚餐": <Moon {...icon(15)} />,
  "加餐": <Coffee {...icon(15)} />,
};

/** Nutrient → icon */
export const NUTRIENT_ICONS: Record<string, React.ReactNode> = {
  calories: <Flame {...icon(14)} />,
  protein: <Drumstick {...icon(14)} />,
  carbs:   <Wheat {...icon(14)} />,
  fat:     <Droplets {...icon(14)} />,
};

/** Ingredient category → icon (fridge) */
export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "蔬菜": <Carrot {...icon(15)} />,
  "肉类": <Drumstick {...icon(15)} />,
  "蛋奶": <Egg {...icon(15)} />,
  "调味料": <Flame {...icon(15)} />,
  "干货": <Wheat {...icon(15)} />,
  "其他": <ShoppingCart {...icon(15)} />,
};

/** Quick-action → icon (home page) */
export const QUICK_ACTION_ICONS: Record<string, React.ReactNode> = {
  "🥗": <ChefHat {...icon(16)} />,
  "📷": <Camera {...icon(16)} />,
  "🧊": <Snowflake {...icon(16)} />,
  "📅": <Calendar {...icon(16)} />,
};

/** Generic page-level icons (hero, empty-states, actions) */
export const PageIcon = {
  home:        <ChefHat {...icon(28)} />,
  nutrition:   <UtensilsCrossed {...icon(18)} />,
  fridge:      <Snowflake {...icon(18)} />,
  history:     <Clock {...icon(18)} />,
  recipes:     <BookOpen {...icon(18)} />,
  shopping:    <ShoppingCart {...icon(18)} />,
  mealPlan:    <Calendar {...icon(18)} />,
  preferences: <Users {...icon(18)} />,
  profile:     <Users {...icon(18)} />,
  sparkle:     <Sparkles {...icon(18)} />,
  search:      <Search {...icon(16)} />,
  camera:      <Camera {...icon(16)} />,
  close:       <X {...icon(16)} />,
  edit:        <Pencil {...icon(14)} />,
  delete:      <Trash2 {...icon(14)} />,
  add:         <Plus {...icon(16)} />,
  check:       <Check {...icon(16)} />,
  star:        <Star {...icon(14)} />,
  starFill:    <Star {...icon(14)} fill="var(--golden)" />,
  warning:     <AlertTriangle {...icon(16)} />,
  clock:       <Clock {...icon(14)} />,
  flame:       <Flame {...icon(14)} />,
} as const;
