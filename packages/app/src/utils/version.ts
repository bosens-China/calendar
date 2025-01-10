import { STORE_KEY } from '@/constant';
import { version, name } from '../../package.json';

const key = `${name}_version`;

type Expression = '<=' | '>=' | '=' | '<' | '>';

type Incompatible = `${Expression} ${string}`;

const incompatibleList: Record<string, Incompatible[]> = {
  '1.1.0': ['< 1.1.0'],
};

export const setVersion = () => {
  window.localStorage.setItem(key, version);
};

export const getVersion = () => {
  return window.localStorage.getItem(key);
};

/**
 * 版本检测，不符合直接清理
 *
 * @return {*}
 */
export const versionDetection = () => {
  const keys = incompatibleList[version];
  if (!keys) {
    return;
  }
  // 只要有一个符合就直接执行清理操作
  const result = keys.some((key) => {
    const [expression, value] = key.split(' ');
    const result = eval(`${version} ${expression} ${value}`);
    return result;
  });
  if (result) {
    return;
  }
  window.localStorage.removeItem(STORE_KEY);
};
