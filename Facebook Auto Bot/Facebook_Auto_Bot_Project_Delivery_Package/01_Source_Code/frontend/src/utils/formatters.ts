import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

// 配置dayjs
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 格式化日期时间
 * @param date 日期字符串或Date对象
 * @param format 格式字符串，默认 'YYYY-MM-DD HH:mm'
 * @returns 格式化后的日期字符串
 */
export const formatDate = (date: string | Date | null | undefined, format: string = 'YYYY-MM-DD HH:mm'): string => {
  if (!date) return '-';
  
  try {
    return dayjs(date).format(format);
  } catch (error) {
    console.error('日期格式化错误:', error);
    return String(date);
  }
};

/**
 * 格式化相对时间（例如：3分钟前）
 * @param date 日期字符串或Date对象
 * @returns 相对时间字符串
 */
export const formatRelativeTime = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  
  try {
    return dayjs(date).fromNow();
  } catch (error) {
    console.error('相对时间格式化错误:', error);
    return String(date);
  }
};

/**
 * 格式化持续时间（例如：2小时30分钟）
 * @param milliseconds 毫秒数
 * @returns 格式化后的持续时间字符串
 */
export const formatDuration = (milliseconds: number): string => {
  if (!milliseconds && milliseconds !== 0) return '-';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}天${hours % 24}小时`;
  }
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  }
  
  if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  }
  
  return `${seconds}秒`;
};

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @param decimals 小数位数，默认2
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * 格式化数字（添加千位分隔符）
 * @param number 数字
 * @returns 格式化后的数字字符串
 */
export const formatNumber = (number: number | string): string => {
  if (number === null || number === undefined) return '0';
  
  const num = typeof number === 'string' ? parseFloat(number) : number;
  
  if (isNaN(num)) return String(number);
  
  return num.toLocaleString('zh-CN');
};

/**
 * 格式化百分比
 * @param value 百分比值（0-100）
 * @param decimals 小数位数，默认1
 * @returns 格式化后的百分比字符串
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  if (value === null || value === undefined) return '0%';
  
  return `${value.toFixed(decimals)}%`;
};

/**
 * 截断文本
 * @param text 原始文本
 * @param maxLength 最大长度
 * @param suffix 后缀，默认 '...'
 * @returns 截断后的文本
 */
export const truncateText = (text: string, maxLength: number, suffix: string = '...'): string => {
  if (!text) return '';
  
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + suffix;
};

/**
 * 格式化手机号码
 * @param phone 手机号码
 * @returns 格式化后的手机号码
 */
export const formatPhone = (phone: string): string => {
  if (!phone) return '';
  
  // 移除所有非数字字符
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
  }
  
  return phone;
};

/**
 * 格式化金额
 * @param amount 金额
 * @param currency 货币符号，默认 '¥'
 * @param decimals 小数位数，默认2
 * @returns 格式化后的金额字符串
 */
export const formatCurrency = (amount: number, currency: string = '¥', decimals: number = 2): string => {
  if (amount === null || amount === undefined) return `${currency}0.00`;
  
  return `${currency}${amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * 格式化JSON字符串（美化输出）
 * @param json JSON字符串或对象
 * @param indent 缩进空格数，默认2
 * @returns 格式化后的JSON字符串
 */
export const formatJSON = (json: string | object, indent: number = 2): string => {
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    return JSON.stringify(obj, null, indent);
  } catch (error) {
    console.error('JSON格式化错误:', error);
    return typeof json === 'string' ? json : JSON.stringify(json);
  }
};

/**
 * 格式化标签数组
 * @param tags 标签数组
 * @param maxTags 显示的最大标签数，默认3
 * @returns 格式化后的标签字符串
 */
export const formatTags = (tags: string[], maxTags: number = 3): string => {
  if (!tags || tags.length === 0) return '';
  
  if (tags.length <= maxTags) {
    return tags.join(', ');
  }
  
  return `${tags.slice(0, maxTags).join(', ')} 等${tags.length - maxTags}个`;
};

/**
 * 获取时间范围描述
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 时间范围描述
 */
export const formatDateRange = (startDate: string | Date, endDate: string | Date): string => {
  if (!startDate || !endDate) return '';
  
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  
  if (start.isSame(end, 'day')) {
    return `${start.format('YYYY-MM-DD')} ${start.format('HH:mm')} - ${end.format('HH:mm')}`;
  }
  
  return `${start.format('YYYY-MM-DD HH:mm')} - ${end.format('YYYY-MM-DD HH:mm')}`;
};

export default {
  formatDate,
  formatRelativeTime,
  formatDuration,
  formatFileSize,
  formatNumber,
  formatPercentage,
  truncateText,
  formatPhone,
  formatCurrency,
  formatJSON,
  formatTags,
  formatDateRange,
};