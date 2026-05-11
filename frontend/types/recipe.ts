/**
 * 菜谱相关类型定义
 */

/**
 * 菜谱数据结构
 */
export interface Recipe {
  /** 唯一标识 */
  id: string;
  /** 菜品名称 */
  title: string;
  /** 完整做法内容（Markdown 格式） */
  content: string;
  /** 菜品图片 URL */
  imageUrl?: string;
  /** 难度等级 */
  difficulty?: '简单' | '中等' | '困难';
  /** 烹饪时间 */
  cookingTime?: string;
  /** 食材清单 */
  ingredients?: string[];
  /** 调味料清单 */
  seasonings?: string[];
  /** 步骤列表（解析后的） */
  steps?: string[];
  /** 推荐指数（0-100） */
  score?: number;
  /** 推荐理由 */
  reason?: string;
  /** 原食谱链接 */
  sourceUrl?: string;
  /** 视频教程链接（B站等） */
  videoUrl?: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
  /** 标签（如：家常、川菜、快手） */
  tags?: string[];
  /** 是否展开显示（UI 状态） */
  isExpanded?: boolean;
}

/**
 * 菜谱存储结构（用于 localStorage）
 * 菜谱全局持久化，不绑定特定会话
 */
export interface RecipeStore {
  /** 菜谱列表 - 所有会话共享 */
  recipes: Recipe[];
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 添加菜谱请求
 * 菜谱全局存储，不绑定特定会话
 * 字段名与后端 RecipeCreate 模型保持一致（snake_case）
 */
export interface AddRecipeRequest {
  /** 菜品名称 */
  title: string;
  /** 完整做法内容 */
  content: string;
  /** 菜品图片 URL */
  image_url?: string;
  /** 难度等级 */
  difficulty?: string;
  /** 烹饪时间 */
  cooking_time?: string;
  /** 视频教程链接 */
  video_url?: string;
}

/**
 * 菜谱操作响应
 */
export interface RecipeOperationResponse {
  /** 操作是否成功 */
  success: boolean;
  /** 菜谱数据（可选） */
  recipe?: Recipe;
  /** 错误信息（可选） */
  error?: string;
}

/**
 * 菜谱列表响应（后端 API）
 */
export interface RecipeListResponse {
  /** 菜谱列表 */
  recipes: Recipe[];
  /** 总数 */
  total: number;
}
