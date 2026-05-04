/**
 * 图片 URL 工具函数
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * 将外部图片 URL 转换为后端代理 URL，避免浏览器 CORS 问题
 * @param url - 原始图片 URL
 * @returns 代理后的 URL（如果是外部 URL），或原始 URL（如果已经是代理 URL 或相对路径）
 */
export function proxyImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  
  // 已经是代理 URL 或相对路径，直接返回
  if (url.startsWith('/api/')) return API_BASE ? `${API_BASE}${url}` : url;
  if (url.startsWith('/')) return url;
  if (url.startsWith('data:')) return url;
  
  // 本地地址不需要代理
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) return url;
  
  // 外部 URL 需要代理
  try {
    const encoded = encodeURIComponent(url);
    const proxyPath = `/api/v1/oss/proxy-image?url=${encoded}`;
    return API_BASE ? `${API_BASE}${proxyPath}` : proxyPath;
  } catch {
    return url;
  }
}

/**
 * 将代理 URL 转换回原始 URL（用于保存等场景）
 * @param url - 可能是代理 URL
 * @returns 原始 URL
 */
export function unproxyImageUrl(url: string): string {
  if (!url) return '';
  
  const proxyPrefix = '/api/v1/oss/proxy-image?url=';
  if (url.startsWith(proxyPrefix)) {
    try {
      return decodeURIComponent(url.slice(proxyPrefix.length));
    } catch {
      return url;
    }
  }
  
  return url;
}
